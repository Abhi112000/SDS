import dbConnect from '@/lib/mongodb';
import { getLedgerAdmin } from '@/lib/ledger-auth';
import LedgerParty from '@/models/LedgerParty';
import LedgerTransaction from '@/models/LedgerTransaction';
import LedgerAccount from '@/models/LedgerAccount';
import { ledgerDateBoundary } from '@/lib/ledger';
import { calculateAccountMovement, calculateCustomerLedger, calculateSupplierOutstanding, isAccountTransactionIncluded } from '@/lib/ledger-calculations';

const ACCOUNT_NAMES = ['cash', 'upi', 'bank', 'other'];

function newAmounts() {
  return { salesPaise: 0, grossSalesPaise: 0, salesRefundsPaise: 0, inflowPaise: 0, outflowPaise: 0, purchasesPaise: 0, supplierPaymentsPaise: 0, expensesPaise: 0, ownerWithdrawalsPaise: 0, ownerReimbursementsPaise: 0, ownerInvestmentsPaise: 0, accounts: Object.fromEntries(ACCOUNT_NAMES.map(account => [account, 0])) };
}

function addRows(result, rows) {
  for (const row of rows) {
    const { type, account, transferTo } = row._id;
    const accountSplit = {
      cash: row.cashPaise || 0,
      upi: row.upiPaise || 0,
      bank: row.bankPaise || 0,
      other: row.otherPaise || 0
    };
    const splitTotal = ACCOUNT_NAMES.reduce((total, name) => total + (accountSplit[name] || 0), 0);
    if (type === 'sale' || type === 'credit_sale') {
      result.grossSalesPaise += row.amount;
      result.salesPaise += row.amount;
    }
    if (type === 'sales_refund') {
      result.salesRefundsPaise += row.amount;
      result.salesPaise -= row.amount;
      result.outflowPaise += row.amount;
      if (result.accounts[account] !== undefined) result.accounts[account] -= row.amount;
    }
    if (['sale', 'customer_payment', 'other_receipt'].includes(type)) {
      result.inflowPaise += row.amount;
      if (type === 'sale' && splitTotal > 0) {
        for (const name of ACCOUNT_NAMES) result.accounts[name] += accountSplit[name] || 0;
        if (row.amount > splitTotal && result.accounts[account] !== undefined) result.accounts[account] += row.amount - splitTotal;
      } else if (result.accounts[account] !== undefined) result.accounts[account] += row.amount;
    }
    if (['supplier_payment', 'expense', 'owner_withdrawal', 'owner_reimbursement', 'other_payment'].includes(type)) {
      result.outflowPaise += row.amount;
      if (result.accounts[account] !== undefined) result.accounts[account] -= row.amount;
      if (type === 'supplier_payment') result.supplierPaymentsPaise += row.amount;
      if (type === 'expense') result.expensesPaise += row.amount;
      if (type === 'owner_withdrawal') result.ownerWithdrawalsPaise += row.amount;
      if (type === 'owner_reimbursement') result.ownerReimbursementsPaise += row.amount;
    }
    if (type === 'owner_investment') {
      result.ownerInvestmentsPaise += row.amount;
    }
    if (type === 'supplier_purchase' || type === 'market_purchase') {
      result.purchasesPaise += row.amount;
      result.outflowPaise += row.paid;
      if (type === 'market_purchase' && splitTotal > 0) {
        for (const name of ACCOUNT_NAMES) result.accounts[name] -= accountSplit[name] || 0;
        if (row.paid > splitTotal && result.accounts[account] !== undefined) result.accounts[account] -= row.paid - splitTotal;
      } else if (result.accounts[account] !== undefined) result.accounts[account] -= row.paid;
    }
    if (type === 'transfer') {
      if (result.accounts[account] !== undefined) result.accounts[account] -= row.amount;
      if (result.accounts[transferTo] !== undefined) result.accounts[transferTo] += row.amount;
    }
  }
  result.netFlowPaise = result.inflowPaise - result.outflowPaise;
}

const groupedTransactions = (match) => LedgerTransaction.aggregate([
  { $match: match },
  { $group: {
    _id: { type: '$type', account: '$account', transferTo: '$transferTo' },
    amount: { $sum: '$amountPaise' },
    paid: { $sum: '$paidAmountPaise' },
    cashPaise: { $sum: { $ifNull: ['$paidByAccountPaise.cash', 0] } },
    upiPaise: { $sum: { $ifNull: ['$paidByAccountPaise.upi', 0] } },
    bankPaise: { $sum: { $ifNull: ['$paidByAccountPaise.bank', 0] } },
    otherPaise: { $sum: { $ifNull: ['$paidByAccountPaise.other', 0] } }
  } }
]);

export default async function handler(req, res) {
  await dbConnect();
  const admin = await getLedgerAdmin(req);
  if (!admin) return res.status(403).json({ error: 'admin required' });
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const from = ledgerDateBoundary(req.query.from);
    const to = ledgerDateBoundary(req.query.to, true);
    if (req.query.from && !from) return res.status(400).json({ error: 'Invalid start date' });
    if (req.query.to && !to) return res.status(400).json({ error: 'Invalid end date' });
    if (from && to && from > to) return res.status(400).json({ error: 'Start date must be on or before end date' });

    const periodFilter = { status: { $in: ['finalized', null] } };
    if (from || to) {
      periodFilter.date = {};
      if (from) periodFilter.date.$gte = from;
      if (to) periodFilter.date.$lte = to;
    }
    const accountTransactionFilter = {
      status: { $in: ['finalized', null] },
      type: { $in: ['sale', 'credit_sale', 'customer_payment', 'other_receipt', 'sales_refund', 'supplier_payment', 'expense', 'owner_withdrawal', 'owner_reimbursement', 'other_payment', 'supplier_purchase', 'market_purchase', 'transfer'] }
    };
    if (to) accountTransactionFilter.date = { $lte: to };
    const [periodRows, partyRows, customers, suppliers, accountSettings, accountTransactions] = await Promise.all([
      groupedTransactions(periodFilter),
      LedgerTransaction.find({
        partyId: { $ne: null },
        status: { $in: ['finalized', null] }
      }).sort({ date: 1, createdAt: 1 }).lean(),
      LedgerParty.find({ type: 'customer' }).select('openingBalancePaise').lean(),
      LedgerParty.find({ type: 'supplier' }).select('openingBalancePaise').lean(),
      LedgerAccount.find({}).lean(),
      LedgerTransaction.find(accountTransactionFilter)
        .select('status type account transferTo amountPaise paidAmountPaise paidByAccountPaise date createdAt')
        .lean()
    ]);

    const period = newAmounts();
    addRows(period, periodRows);
    const settingMap = new Map(accountSettings.map(item => [item.account, item]));
    const openingBalances = {};
    const closingBalances = {};
    const openingBalanceDates = {};
    let incompleteOpeningHistory = false;
    for (const account of ACCOUNT_NAMES) {
      const setting = settingMap.get(account);
      const baseBalance = setting?.openingBalancePaise || 0;
      const effectiveFrom = setting?.openingBalanceDate || new Date(0);
      openingBalanceDates[account] = effectiveFrom;
      if (from && from < effectiveFrom) incompleteOpeningHistory = true;
      const includedTransactions = accountTransactions.filter(item => isAccountTransactionIncluded(item, effectiveFrom));
      const priorTransactions = from
        ? includedTransactions.filter(item => new Date(item.date) < from)
        : [];
      const periodTransactions = includedTransactions.filter(item =>
        (!from || new Date(item.date) >= from) && (!to || new Date(item.date) <= to)
      );
      openingBalances[account] = baseBalance + calculateAccountMovement(account, priorTransactions);
      period.accounts[account] = calculateAccountMovement(account, periodTransactions);
      closingBalances[account] = openingBalances[account] + period.accounts[account];
    }

    const partyMap = new Map();
    for (const item of partyRows) {
      const key = String(item.partyId);
      if (!partyMap.has(key)) partyMap.set(key, []);
      partyMap.get(key).push(item);
    }
    const customerTotals = customers.reduce((totals, customer) => {
      const balance = calculateCustomerLedger(customer.openingBalancePaise, partyMap.get(String(customer._id)) || [], to || undefined);
      totals.outstanding += Math.max(0, balance.outstandingPaise);
      totals.advance += Math.max(0, balance.advancePaise);
      return totals;
    }, { outstanding: 0, advance: 0 });
    const supplierOutstanding = suppliers.reduce((total, supplier) => {
      const balance = calculateSupplierOutstanding(supplier.openingBalancePaise, partyMap.get(String(supplier._id)) || [], to || undefined);
      return total + Math.max(0, balance.outstandingPaise);
    }, 0);

    return res.status(200).json({
      ...period,
      openingBalances,
      openingBalanceDates,
      incompleteOpeningHistory,
      closingBalances,
      combinedOpeningBalancePaise: Object.values(openingBalances).reduce((sum, balance) => sum + balance, 0),
      combinedClosingBalancePaise: Object.values(closingBalances).reduce((sum, balance) => sum + balance, 0),
      customerOutstandingPaise: customerTotals.outstanding,
      customerAdvancePaise: customerTotals.advance,
      supplierOutstandingPaise: supplierOutstanding,
      from: req.query.from || null,
      to: req.query.to || null
    });
  } catch (error) {
    console.error('ledger summary failed', error);
    return res.status(500).json({ error: 'Unable to calculate ledger summary' });
  }
}
