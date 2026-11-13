import dbConnect from '@/lib/mongodb';
import { getLedgerAdmin } from '@/lib/ledger-auth';
import LedgerAccount from '@/models/LedgerAccount';
import LedgerTransaction from '@/models/LedgerTransaction';
import { toSignedPaise } from '@/lib/ledger';
import { calculateAccountMovement } from '@/lib/ledger-calculations';

const ACCOUNTS = ['cash', 'upi', 'bank', 'other'];

export default async function handler(req, res) {
  await dbConnect();
  const admin = await getLedgerAdmin(req);
  if (!admin) return res.status(403).json({ error: 'admin required' });
  const actorId = String(admin.id || '');

  if (req.method === 'GET') {
    try {
      const accounts = await Promise.all(ACCOUNTS.map(account => LedgerAccount.findOneAndUpdate(
        { account }, { $setOnInsert: { account } }, { new: true, upsert: true }
      ).lean()));
      const summaries = [];
      for (const item of accounts) {
        const transactions = await LedgerTransaction.find({
          status: { $ne: 'voided' },
          $or: [
            { date: { $gte: item.openingBalanceDate } },
            { createdAt: { $gt: item.openingBalanceDate } }
          ]
        }).select('status type account transferTo amountPaise paidAmountPaise paidByAccountPaise createdAt date').lean();
        const movement = calculateAccountMovement(item.account, transactions);
        summaries.push({ ...item, calculatedBalancePaise: item.openingBalancePaise + movement });
      }
      return res.status(200).json({ accounts: summaries });
    } catch (error) {
      console.error('ledger account balances failed', error);
      return res.status(500).json({ error: 'Unable to load payment account balances' });
    }
  }

  if (req.method === 'PATCH') {
    try {
      const { account, action, amount, asOfDate, note = '', reason = '' } = req.body || {};
      if (!ACCOUNTS.includes(account)) return res.status(400).json({ error: 'Invalid payment account' });
      const doc = await LedgerAccount.findOneAndUpdate({ account }, { $setOnInsert: { account } }, { new: true, upsert: true });
      if (action === 'opening-balance') {
        const openingBalancePaise = toSignedPaise(amount);
        if (openingBalancePaise === null) return res.status(400).json({ error: 'Enter a valid opening balance (up to two decimals)' });
        const openingBalanceDate = asOfDate ? new Date(asOfDate) : null;
        if (!openingBalanceDate || Number.isNaN(openingBalanceDate.getTime())) return res.status(400).json({ error: 'Select the opening balance date' });
        const correctionReason = String(reason).trim();
        if (doc.audit.some(entry => entry.action === 'opening_balance_updated') && !correctionReason) return res.status(400).json({ error: 'A reason is required to change an existing opening balance' });
        doc.audit.push({
          action: 'opening_balance_updated', actorId, at: new Date(), reason: correctionReason,
          changes: { before: { amount: doc.openingBalancePaise, date: doc.openingBalanceDate }, after: { amount: openingBalancePaise, date: openingBalanceDate } }
        });
        doc.openingBalancePaise = openingBalancePaise;
        doc.openingBalanceDate = openingBalanceDate;
      } else if (action === 'reconcile') {
        const statementBalancePaise = toSignedPaise(amount);
        const reconciliationDate = asOfDate ? new Date(asOfDate) : null;
        if (statementBalancePaise === null) return res.status(400).json({ error: 'Enter a valid statement balance' });
        if (!reconciliationDate || Number.isNaN(reconciliationDate.getTime())) return res.status(400).json({ error: 'Select the statement date' });
        const endOfDay = new Date(reconciliationDate);
        endOfDay.setHours(23, 59, 59, 999);
        const filter = {
          $and: [
            {
              $or: [
                { status: 'finalized' },
                { status: { $ne: 'voided' }, type: { $in: ['sale', 'credit_sale'] } }
              ]
            },
            { date: { $lte: endOfDay, $gte: doc.openingBalanceDate } }
          ]
        };
        const transactions = await LedgerTransaction.find(filter).select('status type account transferTo amountPaise paidAmountPaise paidByAccountPaise').lean();
        const movement = calculateAccountMovement(account, transactions);
        const calculatedBalancePaise = doc.openingBalancePaise + movement;
        const reconciliation = {
          asOfDate: endOfDay, statementBalancePaise, note: String(note).trim(), actorId, createdAt: new Date()
        };
        doc.reconciliations.push(reconciliation);
        doc.audit.push({
          action: 'reconciled', actorId, at: new Date(), reason: String(note).trim(),
          changes: { calculatedBalancePaise, statementBalancePaise, differencePaise: statementBalancePaise - calculatedBalancePaise }
        });
      } else {
        return res.status(400).json({ error: 'action must be opening-balance or reconcile' });
      }
      doc.updatedBy = actorId;
      doc.updatedAt = new Date();
      await doc.save();
      return res.status(200).json({ account: doc });
    } catch (error) {
      console.error('ledger account update failed', error);
      return res.status(500).json({ error: 'Unable to update payment account' });
    }
  }

  res.setHeader('Allow', 'GET, PATCH');
  return res.status(405).json({ error: 'Method not allowed' });
}
