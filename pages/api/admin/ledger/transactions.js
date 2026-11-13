import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';
import { getLedgerAdmin } from '@/lib/ledger-auth';
import LedgerParty from '@/models/LedgerParty';
import LedgerTransaction from '@/models/LedgerTransaction';
import LedgerExpenseCategory from '@/models/LedgerExpenseCategory';
import { ledgerTransactionError, LEDGER_TYPES, toPaise } from '@/lib/ledger';
import { calculateCustomerLedger, calculateSupplierOutstanding } from '@/lib/ledger-calculations';

const PAYMENT_ACCOUNTS = ['cash', 'upi', 'bank', 'other'];

function rupeesFromPaise(value = 0) {
  return (value / 100).toFixed(2);
}

function transactionInput(body) {
  const amountPaise = toPaise(body.amount);
  const paidAmountPaise = body.paidAmount === undefined || body.paidAmount === '' ? 0 : toPaise(body.paidAmount);
  const type = body.type;
  const paidByAccountPaise = body.paidByAccount == null ? undefined : Object.fromEntries(
    PAYMENT_ACCOUNTS.map(account => [account, toPaise(body.paidByAccount[account] || '0')])
  );
  return {
    type,
    date: body.date ? new Date(body.date) : null,
    amountPaise,
    paidAmountPaise,
    paidByAccountPaise,
    ownerContributionPaise: body.ownerContribution === undefined || body.ownerContribution === '' ? 0 : toPaise(body.ownerContribution),
    appliedAmountPaise: type === 'customer_payment' || body.appliedAmount === undefined || body.appliedAmount === ''
      ? null
      : toPaise(body.appliedAmount),
    advanceAppliedPaise: body.advanceApplied === undefined || body.advanceApplied === '' ? 0 : toPaise(body.advanceApplied),
    partyId: ['credit_sale', 'customer_payment', 'supplier_purchase', 'supplier_payment', 'market_purchase'].includes(type) ? (body.partyId || null) : null,
    account: body.account || (body.type === 'credit_sale' ? 'credit' : ''),
    transferTo: body.transferTo || '',
    category: String(body.category || '').trim(),
    linkedTransactionId: body.linkedTransactionId || null,
    reference: String(body.reference || '').trim(),
    idempotencyKey: body.idempotencyKey || undefined,
    description: String(body.description || '').trim(),
    status: body.status || 'finalized'
  };
}

async function validateOwnerFunding(input, excludeId) {
  if (!['owner_reimbursement', 'owner_investment'].includes(input.type)) return '';
  if (!mongoose.isValidObjectId(input.linkedTransactionId)) return 'Link this entry to a valid market purchase';
  const purchase = await LedgerTransaction.findOne({
    _id: input.linkedTransactionId,
    type: 'market_purchase',
    status: 'finalized'
  }).select('date ownerContributionPaise').lean();
  if (!purchase || !purchase.ownerContributionPaise) return 'The linked purchase has no owner-funded amount available';
  if (new Date(input.date) < new Date(purchase.date)) return 'Reimbursement or investment date cannot be before the purchase date';

  const filter = {
    linkedTransactionId: purchase._id,
    type: { $in: ['owner_reimbursement', 'owner_investment'] },
    status: 'finalized'
  };
  if (excludeId) filter._id = { $ne: excludeId };
  const allocations = await LedgerTransaction.find(filter).select('amountPaise').lean();
  const allocatedPaise = allocations.reduce((total, item) => total + item.amountPaise, 0);
  if (allocatedPaise + input.amountPaise > purchase.ownerContributionPaise) {
    return 'This amount exceeds the remaining reimbursement balance for the linked purchase';
  }
  return '';
}

async function validatePurchaseOwnerAllocations(purchaseId, ownerContributionPaise, date) {
  const allocations = await LedgerTransaction.find({
    linkedTransactionId: purchaseId,
    type: { $in: ['owner_reimbursement', 'owner_investment'] },
    status: 'finalized'
  }).select('amountPaise date').lean();
  const allocatedPaise = allocations.reduce((total, item) => total + item.amountPaise, 0);
  if (allocatedPaise > ownerContributionPaise) return 'The owner-funded amount cannot be less than reimbursements and investments already recorded';
  if (allocations.some(item => new Date(item.date) < new Date(date))) return 'Purchase date cannot be moved after a linked reimbursement or investment';
  return '';
}

function validatePurchaseFunding(input, strictBreakdown = false) {
  if (!Number.isSafeInteger(input.ownerContributionPaise) || input.ownerContributionPaise < 0) return 'Owner-funded amount must be valid';
  if (input.ownerContributionPaise > input.amountPaise) return 'Owner-funded amount cannot exceed the market purchase bill';
  if (input.type === 'market_purchase' && input.paidAmountPaise + input.ownerContributionPaise > input.amountPaise) {
    return 'Shop and personal funding cannot exceed the market purchase bill';
  }
  if (input.paidByAccountPaise) {
    const amounts = Object.values(input.paidByAccountPaise);
    if (amounts.some(amount => !Number.isSafeInteger(amount) || amount < 0)) return 'Payment-account amounts must be valid';
    const totalPaidPaise = amounts.reduce((total, amount) => total + amount, 0);
    if (!['sale', 'market_purchase'].includes(input.type)) return 'Payment-account split is only available for sales and market purchases';
    if (input.type === 'sale' && (input.ownerContributionPaise !== 0 || totalPaidPaise !== input.amountPaise)) {
      return 'Cash and online sales amounts must add up to total sales';
    }
    if (input.type === 'market_purchase' && totalPaidPaise !== input.paidAmountPaise) {
      return 'Shop cash and online amounts must add up to the amount paid from shop funds';
    }
  }
  if (input.ownerContributionPaise > 0 && input.type !== 'market_purchase') return 'Owner-funded amounts can only be recorded on market purchases';
  if (strictBreakdown && input.type === 'market_purchase' &&
    input.paidByAccountPaise && input.paidAmountPaise + input.ownerContributionPaise !== input.amountPaise) {
    return 'Shop funds and personal funds must add up to the market purchase bill';
  }
  return '';
}

function throughDate(date) {
  const end = new Date(date);
  end.setUTCHours(23, 59, 59, 999);
  return end;
}

async function getPartyTimeline(partyId, partyType, excludeId) {
  const party = await LedgerParty.findOne({ _id: partyId, type: partyType }).select('openingBalancePaise type').lean();
  if (!party) return null;
  const filter = {
    partyId: new mongoose.Types.ObjectId(partyId),
    status: { $in: ['finalized', null] }
  };
  if (excludeId) filter._id = { $ne: new mongoose.Types.ObjectId(excludeId) };
  const transactions = await LedgerTransaction.find(filter).sort({ date: 1, createdAt: 1 }).lean();
  return { party, transactions };
}

async function getPartyBalance(partyId, partyType, excludeId, date) {
  const timeline = await getPartyTimeline(partyId, partyType, excludeId);
  if (!timeline) return null;
  return partyType === 'customer'
    ? calculateCustomerLedger(timeline.party.openingBalancePaise, timeline.transactions, date ? throughDate(date) : undefined)
    : calculateSupplierOutstanding(timeline.party.openingBalancePaise, timeline.transactions, date ? throughDate(date) : undefined);
}

async function validatePartyTimeline(partyId, partyType, existing, proposed) {
  const timeline = await getPartyTimeline(partyId, partyType);
  if (!timeline) return 'Select a valid account';
  const next = timeline.transactions.filter(item => !existing || String(item._id) !== String(existing._id));
  if (proposed.status === 'finalized') next.push({
    ...proposed, _id: 'pending', partyId, createdAt: proposed.createdAt || new Date()
  });
  const recalculated = partyType === 'customer'
    ? calculateCustomerLedger(timeline.party.openingBalancePaise, next)
    : calculateSupplierOutstanding(timeline.party.openingBalancePaise, next);
  if (recalculated.error) return recalculated.error.message;
  return '';
}

export default async function handler(req, res) {
  await dbConnect();
  const admin = await getLedgerAdmin(req);
  if (!admin) return res.status(403).json({ error: 'admin required' });
  const actorId = String(admin.id || '');

  if (req.method === 'GET') {
    try {
      const { type, from, to, partyId, linkedTransactionId, q = '', page = '1', limit = '50' } = req.query;
      const safePage = Math.max(1, Number(page) || 1);
      const safeLimit = Math.min(100, Math.max(1, Number(limit) || 50));
      const filter = {};
      if (type && LEDGER_TYPES.includes(type)) filter.type = type;
      if (partyId && mongoose.isValidObjectId(partyId)) filter.partyId = partyId;
      if (linkedTransactionId) {
        if (!mongoose.isValidObjectId(linkedTransactionId)) return res.status(400).json({ error: 'Invalid linked transaction id' });
        filter.linkedTransactionId = linkedTransactionId;
      }
      if (String(q).trim()) {
        const escaped = String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escaped, 'i');
        const matchingParties = await LedgerParty.find({ $or: [{ name: regex }, { phone: regex }] }).distinct('_id');
        filter.$or = [{ description: regex }, { reference: regex }, { category: regex }, { partyId: { $in: matchingParties } }];
      }
      if (from || to) {
        filter.date = {};
        if (from && !Number.isNaN(new Date(from).getTime())) filter.date.$gte = new Date(from);
        if (to && !Number.isNaN(new Date(to).getTime())) {
          const end = new Date(to);
          end.setUTCHours(23, 59, 59, 999);
          filter.date.$lte = end;
        }
      }
      const [items, total] = await Promise.all([
        LedgerTransaction.find(filter).sort({ date: -1, createdAt: -1 }).skip((safePage - 1) * safeLimit).limit(safeLimit)
          .populate('partyId', 'name type phone')
          .populate('linkedTransactionId', 'date type amountPaise description')
          .lean(),
        LedgerTransaction.countDocuments(filter)
      ]);
      return res.status(200).json({ items, total, page: safePage, limit: safeLimit });
    } catch (error) {
      console.error('ledger transaction listing failed', error);
      return res.status(500).json({ error: 'Unable to load transactions' });
    }
  }

  if (req.method === 'POST') {
    try {
      const input = transactionInput(req.body || {});
      if (!LEDGER_TYPES.includes(input.type)) return res.status(400).json({ error: 'Invalid transaction type' });
      if (!['draft', 'finalized'].includes(input.status)) return res.status(400).json({ error: 'Status must be draft or finalized' });
      if (input.idempotencyKey !== undefined && (typeof input.idempotencyKey !== 'string' || input.idempotencyKey.length > 128)) return res.status(400).json({ error: 'Invalid idempotency key' });
      if (!input.date || Number.isNaN(input.date.getTime())) return res.status(400).json({ error: 'A valid transaction date is required' });
      if (!Number.isSafeInteger(input.amountPaise) || input.amountPaise <= 0) return res.status(400).json({ error: 'Amount must be a valid positive value with up to two decimals' });
      if (!Number.isSafeInteger(input.paidAmountPaise) || input.paidAmountPaise < 0) return res.status(400).json({ error: 'Paid amount must be valid' });
      const fundingError = validatePurchaseFunding(input, input.type === 'market_purchase' && input.paidByAccountPaise !== undefined);
      if (fundingError) return res.status(400).json({ error: fundingError });
      if (input.appliedAmountPaise !== null && (!Number.isSafeInteger(input.appliedAmountPaise) || input.appliedAmountPaise < 0)) return res.status(400).json({ error: 'Applied payment must be a valid amount' });
      if (!Number.isSafeInteger(input.advanceAppliedPaise) || input.advanceAppliedPaise < 0) return res.status(400).json({ error: 'Applied advance must be a valid amount' });
      const invalid = ledgerTransactionError(input);
      if (invalid) return res.status(400).json({ error: invalid });
      if (input.appliedAmountPaise !== null && (!Number.isSafeInteger(input.appliedAmountPaise) || input.appliedAmountPaise < 0 || input.appliedAmountPaise > input.amountPaise)) return res.status(400).json({ error: 'Applied payment must be between zero and the payment amount' });
      if (input.paidAmountPaise > input.amountPaise) return res.status(400).json({ error: 'Paid amount cannot exceed the transaction amount' });
      if (['supplier_purchase', 'market_purchase'].includes(input.type) && !['cash', 'upi', 'bank', 'other', 'credit'].includes(input.account)) return res.status(400).json({ error: 'Select a payment account or credit' });
      if (['supplier_purchase', 'market_purchase'].includes(input.type) && input.account === 'credit' && input.paidAmountPaise !== 0) return res.status(400).json({ error: 'Credit purchases cannot have an immediate payment' });
      if (input.partyId) {
        if (!mongoose.isValidObjectId(input.partyId)) return res.status(400).json({ error: 'Invalid account selected' });
        const requiredType = ['credit_sale', 'customer_payment'].includes(input.type) ? 'customer' : 'supplier';
        const party = await LedgerParty.findOne({
          _id: input.partyId, type: requiredType, $or: [{ isActive: { $exists: false } }, { isActive: true }]
        }).select('_id').lean();
        if (!party) return res.status(400).json({ error: `Select a valid ${requiredType} account` });
      }
      if (input.type === 'market_purchase' && input.amountPaise > input.paidAmountPaise + input.ownerContributionPaise && !input.partyId) return res.status(400).json({ error: 'Select a supplier to track the unpaid purchase balance' });
      if (input.type === 'supplier_purchase' && input.amountPaise > input.paidAmountPaise && !input.partyId) return res.status(400).json({ error: 'Select a supplier to track the unpaid purchase balance' });
      if (input.type === 'customer_payment') {
        const balance = await getPartyBalance(input.partyId, 'customer', null, input.date);
        if (!balance) return res.status(400).json({ error: 'Select a valid customer' });
        input.appliedAmountPaise = Math.min(balance.outstandingPaise, input.amountPaise);
        if (input.appliedAmountPaise > input.amountPaise || input.appliedAmountPaise > balance.outstandingPaise) return res.status(400).json({ error: 'Applied amount cannot exceed the payment or current outstanding' });
      } else if (input.appliedAmountPaise !== null) {
        return res.status(400).json({ error: 'Only customer payments can have an applied amount' });
      }
      if (input.type === 'credit_sale') {
        const balance = await getPartyBalance(input.partyId, 'customer', null, input.date);
        if (!balance) return res.status(400).json({ error: 'Select a valid customer' });
        if (input.advanceAppliedPaise > balance.advancePaise || input.advanceAppliedPaise > input.amountPaise) return res.status(400).json({ error: 'Applied advance cannot exceed the customer advance or credit sale' });
      } else if (input.advanceAppliedPaise !== 0) {
        return res.status(400).json({ error: 'Only customer credit sales can use customer advances' });
      }
      if (input.partyId && input.status === 'finalized') {
        const partyType = ['credit_sale', 'customer_payment'].includes(input.type) ? 'customer' : 'supplier';
        const allocationError = await validatePartyTimeline(input.partyId, partyType, null, input);
        if (allocationError) return res.status(400).json({ error: allocationError });
      }
      if (input.type === 'expense') {
        const category = await LedgerExpenseCategory.findOne({ name: input.category, active: true }).select('_id').lean();
        if (!category) return res.status(400).json({ error: 'Select an active expense category' });
        if (input.linkedTransactionId) {
          if (!mongoose.isValidObjectId(input.linkedTransactionId)) return res.status(400).json({ error: 'Invalid linked purchase' });
          const purchase = await LedgerTransaction.findOne({ _id: input.linkedTransactionId, type: { $in: ['market_purchase', 'supplier_purchase'] }, status: 'finalized' }).select('_id').lean();
          if (!purchase) return res.status(400).json({ error: 'Linked entry must be a finalized market or supplier purchase' });
          input.duplicateGuard = `${input.linkedTransactionId}:${input.category.toLowerCase()}:${input.amountPaise}`;
          const duplicate = await LedgerTransaction.findOne({ duplicateGuard: input.duplicateGuard }).select('_id').lean();
          if (duplicate) return res.status(409).json({ error: 'The same expense is already linked to this purchase' });
        }
      } else if (input.linkedTransactionId) {
        if (!['owner_reimbursement', 'owner_investment'].includes(input.type)) {
          return res.status(400).json({ error: 'Only expenses, reimbursements and investments can be linked to a purchase' });
        }
      }
      const ownerFundingError = await validateOwnerFunding(input);
      if (ownerFundingError) return res.status(400).json({ error: ownerFundingError });
      const audit = [{ action: 'created', actorId, at: new Date(), reason: '', changes: {} }];
      const transaction = await LedgerTransaction.create({ ...input, createdBy: actorId, updatedBy: actorId, audit });
      return res.status(201).json({
        transaction,
        ...(input.type === 'customer_payment' ? {
          allocation: {
            appliedAmountPaise: input.appliedAmountPaise,
            advancePaise: input.amountPaise - input.appliedAmountPaise
          }
        } : {})
      });
    } catch (error) {
      if (error?.code === 11000) return res.status(409).json({ error: 'This transaction was already recorded' });
      console.error('ledger transaction creation failed', error);
      return res.status(500).json({ error: 'Unable to save transaction' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { id } = req.body || {};
      if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'Valid transaction id is required' });
      const transaction = await LedgerTransaction.findById(id);
      if (!transaction) return res.status(404).json({ error: 'Transaction not found' });

      const linkedEntries = await LedgerTransaction.find({
        linkedTransactionId: transaction._id,
        status: { $ne: 'voided' }
      }).select('type').lean();
      if (linkedEntries.length) {
        return res.status(409).json({
          error: `Delete linked ${linkedEntries.map(item => item.type.replaceAll('_', ' ')).join(', ')} entries first`
        });
      }

      if (transaction.partyId && transaction.status !== 'voided') {
        const partyType = ['credit_sale', 'customer_payment'].includes(transaction.type) ? 'customer' : 'supplier';
        const allocationError = await validatePartyTimeline(
          transaction.partyId,
          partyType,
          transaction,
          { ...transaction.toObject(), status: 'voided' }
        );
        if (allocationError) {
          return res.status(409).json({
            error: `Cannot permanently delete this entry because a later allocation depends on it: ${allocationError}`
          });
        }
      }

      const deletion = await LedgerTransaction.deleteOne({ _id: transaction._id });
      if (!deletion.deletedCount) return res.status(404).json({ error: 'Transaction not found' });
      return res.status(200).json({ deletedId: String(transaction._id) });
    } catch (error) {
      console.error('ledger transaction permanent deletion failed', error);
      return res.status(500).json({ error: 'Unable to permanently delete transaction' });
    }
  }

  if (req.method === 'PATCH') {
    try {
      const { id, action, reason = '', ...body } = req.body || {};
      if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'Valid transaction id is required' });
      const transaction = await LedgerTransaction.findById(id);
      if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
      if (transaction.status === 'voided') return res.status(409).json({ error: 'Voided transactions cannot be changed' });
      const correctionReason = String(reason).trim();
      if (action === 'void') {
        if (!correctionReason) return res.status(400).json({ error: 'A reason is required to void a financial transaction' });
        if (transaction.type === 'market_purchase') {
          const linkedFunding = await LedgerTransaction.exists({
            linkedTransactionId: transaction._id,
            type: { $in: ['owner_reimbursement', 'owner_investment'] },
            status: 'finalized'
          });
          if (linkedFunding) return res.status(409).json({ error: 'Void linked reimbursements or investments before voiding this market purchase' });
        }
        if (transaction.partyId && transaction.status === 'finalized') {
          const partyType = ['credit_sale', 'customer_payment'].includes(transaction.type) ? 'customer' : 'supplier';
          const allocationError = await validatePartyTimeline(transaction.partyId, partyType, transaction, { ...transaction.toObject(), status: 'voided' });
          if (allocationError) return res.status(409).json({ error: `Cannot void this entry because a later allocation depends on it: ${allocationError}` });
        }
        transaction.status = 'voided';
        transaction.voidReason = correctionReason;
        transaction.duplicateGuard = undefined;
        transaction.updatedBy = actorId;
        transaction.updatedAt = new Date();
        transaction.audit.push({ action: 'voided', actorId, at: new Date(), reason: correctionReason, changes: {} });
        await transaction.save();
        return res.status(200).json({ transaction });
      }
      if (action === 'finalize') {
        if (transaction.status !== 'draft') return res.status(409).json({ error: 'Only draft transactions can be finalized' });
        if (transaction.partyId) {
          const partyType = ['credit_sale', 'customer_payment'].includes(transaction.type) ? 'customer' : 'supplier';
          const party = await LedgerParty.findOne({
            _id: transaction.partyId,
            type: partyType,
            $or: [{ isActive: { $exists: false } }, { isActive: true }]
          }).select('_id').lean();
          if (!party) return res.status(400).json({ error: `Restore the ${partyType} account before finalizing this transaction` });
          const allocationError = await validatePartyTimeline(transaction.partyId, partyType, transaction, { ...transaction.toObject(), status: 'finalized' });
          if (allocationError) return res.status(400).json({ error: allocationError });
        }
        const ownerFundingError = await validateOwnerFunding(transaction);
        if (ownerFundingError) return res.status(400).json({ error: ownerFundingError });
        transaction.status = 'finalized';
        transaction.updatedBy = actorId;
        transaction.updatedAt = new Date();
        transaction.audit.push({ action: 'finalized', actorId, at: new Date(), reason: correctionReason, changes: {} });
        await transaction.save();
        return res.status(200).json({ transaction });
      }
      if (transaction.status === 'finalized' && !correctionReason) return res.status(400).json({ error: 'A correction reason is required to edit a finalized transaction' });
      const input = transactionInput({
        ...transaction.toObject(),
        ...body,
        amount: body.amount === undefined ? (transaction.amountPaise / 100).toFixed(2) : body.amount,
        paidAmount: body.paidAmount === undefined ? (transaction.paidAmountPaise / 100).toFixed(2) : body.paidAmount,
        appliedAmount: body.appliedAmount === undefined
          ? (transaction.appliedAmountPaise === undefined ? undefined : (transaction.appliedAmountPaise / 100).toFixed(2))
          : body.appliedAmount,
        advanceApplied: body.advanceApplied === undefined
          ? ((transaction.advanceAppliedPaise || 0) / 100).toFixed(2)
          : body.advanceApplied,
        paidByAccount: body.paidByAccount === undefined && transaction.paidByAccountPaise
          ? Object.fromEntries(PAYMENT_ACCOUNTS.map(account => [account, rupeesFromPaise(transaction.paidByAccountPaise[account] || 0)]))
          : body.paidByAccount,
        ownerContribution: body.ownerContribution === undefined
          ? rupeesFromPaise(transaction.ownerContributionPaise || 0)
          : body.ownerContribution
      });
      if (!LEDGER_TYPES.includes(input.type)) return res.status(400).json({ error: 'Invalid transaction type' });
      const invalid = ledgerTransactionError(input);
      if (invalid) return res.status(400).json({ error: invalid });
      if (!Number.isSafeInteger(input.amountPaise) || input.amountPaise <= 0 || !Number.isSafeInteger(input.paidAmountPaise) || input.paidAmountPaise < 0 || !Number.isSafeInteger(input.advanceAppliedPaise) || input.advanceAppliedPaise < 0) return res.status(400).json({ error: 'Transaction amounts are invalid' });
      const fundingError = validatePurchaseFunding(input, input.type === 'market_purchase' && input.paidByAccountPaise !== undefined);
      if (fundingError) return res.status(400).json({ error: fundingError });
      if (input.appliedAmountPaise !== null && (!Number.isSafeInteger(input.appliedAmountPaise) || input.appliedAmountPaise < 0 || input.appliedAmountPaise > input.amountPaise)) return res.status(400).json({ error: 'Applied payment must be between zero and the payment amount' });
      if (input.paidAmountPaise > input.amountPaise) return res.status(400).json({ error: 'Paid amount cannot exceed the transaction amount' });
      if (['supplier_purchase', 'market_purchase'].includes(input.type) && !['cash', 'upi', 'bank', 'other', 'credit'].includes(input.account)) return res.status(400).json({ error: 'Select a payment account or credit' });
      if (['supplier_purchase', 'market_purchase'].includes(input.type) && input.account === 'credit' && input.paidAmountPaise !== 0) return res.status(400).json({ error: 'Credit purchases cannot have an immediate payment' });
      if (input.partyId) {
        if (!mongoose.isValidObjectId(input.partyId)) return res.status(400).json({ error: 'Invalid account selected' });
        const requiredType = ['credit_sale', 'customer_payment'].includes(input.type) ? 'customer' : 'supplier';
        const unchangedArchivedParty = String(input.partyId) === String(transaction.partyId || '');
        const partyFilter = { _id: input.partyId, type: requiredType };
        if (!unchangedArchivedParty) partyFilter.$or = [{ isActive: { $exists: false } }, { isActive: true }];
        const party = await LedgerParty.findOne(partyFilter).select('_id').lean();
        if (!party) return res.status(400).json({ error: `Select a valid ${requiredType} account` });
      }
      if (input.type === 'market_purchase' && input.amountPaise > input.paidAmountPaise + input.ownerContributionPaise && !input.partyId) return res.status(400).json({ error: 'Select a supplier to track the unpaid purchase balance' });
      if (input.type === 'supplier_purchase' && input.amountPaise > input.paidAmountPaise && !input.partyId) return res.status(400).json({ error: 'Select a supplier to track the unpaid purchase balance' });
      if (transaction.type === 'market_purchase' && input.type === 'market_purchase') {
        const ownerAllocationError = await validatePurchaseOwnerAllocations(transaction._id, input.ownerContributionPaise, input.date);
        if (ownerAllocationError) return res.status(409).json({ error: ownerAllocationError });
      }
      if (input.type === 'customer_payment') {
        const balance = await getPartyBalance(input.partyId, 'customer', transaction._id, input.date);
        if (!balance) return res.status(400).json({ error: 'Select a valid customer' });
        input.appliedAmountPaise = Math.min(balance.outstandingPaise, input.amountPaise);
        if (input.appliedAmountPaise > input.amountPaise || input.appliedAmountPaise > balance.outstandingPaise) return res.status(400).json({ error: 'Applied amount cannot exceed the payment or current outstanding' });
      } else if (input.appliedAmountPaise !== null) {
        return res.status(400).json({ error: 'Only customer payments can have an applied amount' });
      }
      if (input.type === 'credit_sale') {
        const balance = await getPartyBalance(input.partyId, 'customer', transaction._id, input.date);
        if (!balance) return res.status(400).json({ error: 'Select a valid customer' });
        if (input.advanceAppliedPaise > balance.advancePaise || input.advanceAppliedPaise > input.amountPaise) return res.status(400).json({ error: 'Applied advance cannot exceed the customer advance or credit sale' });
      } else if (input.advanceAppliedPaise !== 0) {
        return res.status(400).json({ error: 'Only customer credit sales can use customer advances' });
      }
      if (transaction.status === 'finalized') {
        const partyType = ['credit_sale', 'customer_payment'].includes(input.type) ? 'customer' : 'supplier';
        const previousPartyType = ['credit_sale', 'customer_payment'].includes(transaction.type) ? 'customer' : 'supplier';
        const sameParty = input.partyId && String(input.partyId) === String(transaction.partyId) && previousPartyType === partyType;
        if (transaction.partyId && !sameParty) {
          const previousAccountError = await validatePartyTimeline(transaction.partyId, previousPartyType, transaction, { ...transaction.toObject(), status: 'voided' });
          if (previousAccountError) return res.status(400).json({ error: previousAccountError });
        }
        if (input.partyId) {
          const allocationError = await validatePartyTimeline(input.partyId, partyType, transaction, { ...input, status: transaction.status, createdAt: transaction.createdAt });
          if (allocationError) return res.status(400).json({ error: allocationError });
        }
      }
      if (input.type === 'expense') {
        const category = await LedgerExpenseCategory.findOne({
          name: input.category,
          $or: [{ active: true }, ...(transaction.category === input.category ? [{}] : [])]
        }).select('_id').lean();
        if (!category) return res.status(400).json({ error: 'Select an active expense category' });
        if (input.linkedTransactionId) {
          if (!mongoose.isValidObjectId(input.linkedTransactionId)) return res.status(400).json({ error: 'Invalid linked purchase' });
          const purchase = await LedgerTransaction.findOne({ _id: input.linkedTransactionId, type: { $in: ['market_purchase', 'supplier_purchase'] }, status: 'finalized' }).select('_id').lean();
          if (!purchase) return res.status(400).json({ error: 'Linked entry must be a finalized market or supplier purchase' });
          input.duplicateGuard = `${input.linkedTransactionId}:${input.category.toLowerCase()}:${input.amountPaise}`;
          const duplicate = await LedgerTransaction.findOne({ _id: { $ne: transaction._id }, duplicateGuard: input.duplicateGuard }).select('_id').lean();
          if (duplicate) return res.status(409).json({ error: 'The same expense is already linked to this purchase' });
        }
      } else if (input.linkedTransactionId) {
        if (!['owner_reimbursement', 'owner_investment'].includes(input.type)) {
          return res.status(400).json({ error: 'Only expenses, reimbursements and investments can be linked to a purchase' });
        }
      }
      const ownerFundingError = await validateOwnerFunding(input, transaction._id);
      if (ownerFundingError) return res.status(400).json({ error: ownerFundingError });
      const changes = {};
      for (const key of ['type', 'date', 'amountPaise', 'paidAmountPaise', 'paidByAccountPaise', 'ownerContributionPaise', 'appliedAmountPaise', 'advanceAppliedPaise', 'partyId', 'account', 'transferTo', 'category', 'linkedTransactionId', 'duplicateGuard', 'reference', 'description']) {
        changes[key] = { before: transaction[key] == null ? null : JSON.stringify(transaction[key]), after: input[key] == null ? null : JSON.stringify(input[key]) };
        transaction[key] = input[key];
      }
      transaction.updatedBy = actorId;
      transaction.updatedAt = new Date();
      transaction.audit.push({ action: 'updated', actorId, at: new Date(), reason: correctionReason, changes });
      await transaction.save();
      return res.status(200).json({ transaction });
    } catch (error) {
      console.error('ledger transaction update failed', error);
      return res.status(500).json({ error: 'Unable to update transaction' });
    }
  }

  res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
  return res.status(405).json({ error: 'Method not allowed' });
}
