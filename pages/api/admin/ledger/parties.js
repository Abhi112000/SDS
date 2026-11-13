import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';
import { getLedgerAdmin } from '@/lib/ledger-auth';
import LedgerParty from '@/models/LedgerParty';
import LedgerTransaction from '@/models/LedgerTransaction';
import { calculateCustomerLedger, calculateSupplierOutstanding } from '@/lib/ledger-calculations';

function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}

export default async function handler(req, res) {
  await dbConnect();
  const admin = await getLedgerAdmin(req);
  if (!admin) return res.status(403).json({ error: 'admin required' });
  const actorId = String(admin.id || '');

  if (req.method === 'GET') {
    try {
      const { type, q = '', page = '1', limit = '50', includeArchived = 'false' } = req.query;
      if (!['customer', 'supplier'].includes(type)) return res.status(400).json({ error: 'type must be customer or supplier' });
      const safePage = Math.max(1, Number(page) || 1);
      const safeLimit = Math.min(100, Math.max(1, Number(limit) || 50));
      const filter = { type };
      if (includeArchived !== 'true') filter.$or = [{ isActive: { $exists: false } }, { isActive: true }];
      const search = String(q).trim();
      if (search) {
        const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escaped, 'i');
        filter.$and = [...(filter.$and || []), { $or: [{ name: regex }, { phone: regex }] }];
      }
      const [parties, total] = await Promise.all([
        LedgerParty.find(filter).sort({ name: 1 }).skip((safePage - 1) * safeLimit).limit(safeLimit).lean(),
        LedgerParty.countDocuments(filter)
      ]);
      const ids = parties.map(p => p._id);
      const transactions = ids.length ? await LedgerTransaction.find({
        partyId: { $in: ids },
        status: { $in: ['finalized', null] }
      }).sort({ date: 1, createdAt: 1 }).lean() : [];
      const transactionsByParty = new Map();
      for (const transaction of transactions) {
        const key = String(transaction.partyId);
        if (!transactionsByParty.has(key)) transactionsByParty.set(key, []);
        transactionsByParty.get(key).push(transaction);
      }
      const items = parties.map(p => {
        const partyTransactions = transactionsByParty.get(String(p._id)) || [];
        const balance = p.type === 'customer'
          ? calculateCustomerLedger(p.openingBalancePaise, partyTransactions)
          : calculateSupplierOutstanding(p.openingBalancePaise, partyTransactions);
        const totalCreditsPaise = partyTransactions.filter(t => t.type === 'credit_sale').reduce((sum, t) => sum + t.amountPaise, 0);
        const totalPurchasesPaise = partyTransactions.filter(t => ['supplier_purchase', 'market_purchase'].includes(t.type)).reduce((sum, t) => sum + t.amountPaise, 0);
        const totalPaymentsPaise = p.type === 'customer'
          ? partyTransactions.filter(t => t.type === 'customer_payment').reduce((sum, t) => sum + t.amountPaise, 0)
          : partyTransactions.filter(t => t.type === 'supplier_payment').reduce((sum, t) => sum + t.amountPaise, 0) +
            partyTransactions.filter(t => ['supplier_purchase', 'market_purchase'].includes(t.type)).reduce((sum, t) => sum + (t.paidAmountPaise || 0), 0);
        return {
          ...p,
          outstandingPaise: Math.max(0, balance.outstandingPaise),
          advancePaise: p.type === 'customer' ? Math.max(0, balance.advancePaise) : 0,
          totalCreditsPaise,
          totalPurchasesPaise,
          totalPaymentsPaise
        };
      });
      return res.status(200).json({ items, total, page: safePage, limit: safeLimit });
    } catch (error) {
      console.error('ledger party listing failed', error);
      return res.status(500).json({ error: 'Unable to load ledger accounts' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { type, name, phone = '', address = '', notes = '' } = req.body || {};
      if (!['customer', 'supplier'].includes(type)) return res.status(400).json({ error: 'Invalid account type' });
      if (typeof name !== 'string' || !name.trim()) return res.status(400).json({ error: 'Name is required' });
      const phoneNormalized = normalizePhone(phone);
      const duplicate = phoneNormalized
        ? await LedgerParty.findOne({ type, phoneNormalized }).select('_id name phone').lean()
        : null;
      const party = await LedgerParty.create({
        type, name: name.trim(), phone: String(phone).trim(), phoneNormalized,
        address: String(address).trim(), notes: String(notes).trim(),
        openingBalancePaise: 0, createdBy: actorId, updatedBy: actorId,
        audit: [{ action: 'created', actorId, at: new Date(), changes: {} }]
      });
      return res.status(201).json({ party: party.toObject(), duplicateMobileWarning: duplicate ? { name: duplicate.name, phone: duplicate.phone } : null });
    } catch (error) {
      console.error('ledger party creation failed', error);
      return res.status(500).json({ error: 'Unable to create ledger account' });
    }
  }

  if (req.method === 'DELETE') {
    const { id, confirmation } = req.body || {};
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'Valid customer id is required' });

    const mongoSession = await mongoose.startSession();
    let outcome;
    try {
      await mongoSession.withTransaction(async () => {
        const customer = await LedgerParty.findOne({ _id: id, type: 'customer' }).session(mongoSession);
        if (!customer) {
          outcome = { status: 404, error: 'Customer account not found' };
          return;
        }
        if (confirmation !== customer.name) {
          outcome = { status: 400, error: 'Customer name confirmation does not match' };
          return;
        }

        const transactions = await LedgerTransaction.find({
          partyId: customer._id,
          status: 'finalized'
        }).sort({ date: 1, createdAt: 1 }).session(mongoSession).lean();
        const balance = calculateCustomerLedger(customer.openingBalancePaise, transactions);
        if (balance.error) {
          outcome = { status: 409, error: `Customer khata has an allocation issue and cannot be deleted: ${balance.error.message}` };
          return;
        }
        if (balance.outstandingPaise !== 0 || balance.advancePaise !== 0) {
          outcome = {
            status: 409,
            error: 'Customer can be deleted only when both outstanding and advance balances are zero',
            outstandingPaise: Math.max(0, balance.outstandingPaise),
            advancePaise: Math.max(0, balance.advancePaise)
          };
          return;
        }

        const deletion = await LedgerTransaction.deleteMany({ partyId: customer._id }, { session: mongoSession });
        await LedgerParty.deleteOne({ _id: customer._id }, { session: mongoSession });
        outcome = { status: 200, deletedTransactions: deletion.deletedCount || 0 };
      });
      return res.status(outcome.status).json(outcome);
    } catch (error) {
      console.error('settled customer deletion failed', error);
      return res.status(500).json({ error: 'Unable to safely delete customer and linked ledger entries' });
    } finally {
      await mongoSession.endSession();
    }
  }

  if (req.method === 'PATCH') {
    try {
      const { id, action, reason = '', ...changes } = req.body || {};
      if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'Valid account id is required' });
      const party = await LedgerParty.findById(id);
      if (!party) return res.status(404).json({ error: 'Ledger account not found' });
      if (action === 'archive' || action === 'restore') {
        if (party.type === 'customer' && action === 'archive') {
          return res.status(400).json({ error: 'Customers remain available until their khata is settled; delete a customer only after outstanding and advance are zero' });
        }
        const correctionReason = String(reason).trim();
        if (!correctionReason) return res.status(400).json({ error: 'A reason is required to archive or restore an account' });
        const isActive = action === 'restore';
        if (Boolean(party.isActive) === isActive) return res.status(409).json({ error: isActive ? 'Account is already active' : 'Account is already archived' });
        party.isActive = isActive;
        party.updatedBy = actorId;
        party.updatedAt = new Date();
        party.audit.push({
          action: isActive ? 'restored' : 'archived',
          actorId,
          at: new Date(),
          changes: { reason: correctionReason }
        });
        await party.save();
        return res.status(200).json({ party: party.toObject() });
      }
      const allowed = ['name', 'phone', 'address', 'notes'];
      if (Object.keys(changes).some(key => !allowed.includes(key)) || !Object.keys(changes).length) return res.status(400).json({ error: 'Only name, phone, address and notes can be edited here' });
      const updates = {};
      for (const key of allowed) {
        if (Object.prototype.hasOwnProperty.call(changes, key)) {
          if (typeof changes[key] !== 'string') return res.status(400).json({ error: `${key} must be text` });
          updates[key] = changes[key].trim();
        }
      }
      const before = {};
      for (const key of Object.keys(updates)) before[key] = party[key];
      Object.assign(party, updates, { updatedBy: actorId, updatedAt: new Date() });
      if (Object.prototype.hasOwnProperty.call(updates, 'phone')) party.phoneNormalized = normalizePhone(updates.phone);
      const after = {};
      for (const key of Object.keys(updates)) after[key] = updates[key];
      party.audit.push({ action: 'updated', actorId, at: new Date(), changes: { before, after, reason: String(reason).trim() } });
      await party.save();
      return res.status(200).json({ party: party.toObject(), before, correctionReason: String(reason).trim() });
    } catch (error) {
      console.error('ledger party update failed', error);
      return res.status(500).json({ error: 'Unable to update ledger account' });
    }
  }

  res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
  return res.status(405).json({ error: 'Method not allowed' });
}
