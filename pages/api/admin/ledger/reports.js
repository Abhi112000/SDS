import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';
import { getLedgerAdmin } from '@/lib/ledger-auth';
import LedgerParty from '@/models/LedgerParty';
import LedgerTransaction from '@/models/LedgerTransaction';
import LedgerAccount from '@/models/LedgerAccount';
import LedgerMonthlyBalance from '@/models/LedgerMonthlyBalance';
import { ledgerDateBoundary } from '@/lib/ledger';
import { calculateAccountMovement, calculateCustomerLedger, calculateSupplierOutstanding, isAccountTransactionIncluded } from '@/lib/ledger-calculations';

const REPORTS = {
  sales: ['sale', 'sales_refund', 'credit_sale'],
  purchases: ['supplier_purchase', 'market_purchase'],
  expenses: ['expense'],
  statement: [
    'sale', 'sales_refund', 'customer_payment', 'supplier_payment', 'supplier_purchase',
    'market_purchase', 'expense', 'owner_withdrawal', 'owner_reimbursement',
    'other_receipt', 'other_payment', 'transfer'
  ],
  cashflow: ['sale', 'sales_refund', 'customer_payment', 'supplier_payment', 'market_purchase', 'supplier_purchase', 'expense', 'owner_withdrawal', 'owner_reimbursement', 'other_receipt', 'other_payment', 'transfer'],
  customer: ['credit_sale', 'customer_payment'],
  supplier: ['supplier_purchase', 'supplier_payment', 'market_purchase']
};

function groupExpression(groupBy) {
  if (groupBy === 'month') return { $dateToString: { format: '%Y-%m', date: '$date', timezone: 'Asia/Kolkata' } };
  if (groupBy === 'year') return { $dateToString: { format: '%Y', date: '$date', timezone: 'Asia/Kolkata' } };
  if (groupBy === 'day') return { $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: 'Asia/Kolkata' } };
  if (groupBy === 'category') return { $ifNull: ['$category', '(uncategorized)'] };
  if (groupBy === 'account') return { $ifNull: ['$account', '(no account)'] };
  if (groupBy === 'party') return { $ifNull: ['$partyId', '(no party)'] };
  return '$type';
}

function nextMonthOf(dateValue) {
  if (typeof dateValue !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return '';
  const [year, month] = dateValue.slice(0, 7).split('-').map(Number);
  const next = new Date(Date.UTC(year, month, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`;
}

export default async function handler(req, res) {
  await dbConnect();
  const admin = await getLedgerAdmin(req);
  if (!admin) return res.status(403).json({ error: 'admin required' });
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { report = 'transactions', from, to, groupBy = 'type', partyId, account, category, page = '1', limit = '50' } = req.query;
    if (!['transactions', 'statement', 'sales', 'cashflow', 'customer', 'supplier', 'purchases', 'expenses', 'accounts', 'profit', 'daily', 'monthly', 'yearly'].includes(report)) {
      return res.status(400).json({ error: 'Invalid report type' });
    }
    const start = ledgerDateBoundary(from);
    const end = ledgerDateBoundary(to, true);
    if (from && !start) return res.status(400).json({ error: 'Invalid start date' });
    if (to && !end) return res.status(400).json({ error: 'Invalid end date' });
    if (start && end && start > end) return res.status(400).json({ error: 'Start date must be on or before end date' });
    if (partyId && !mongoose.isValidObjectId(partyId)) return res.status(400).json({ error: 'Invalid account id' });
    if (report === 'accounts' && account && !['cash', 'upi', 'bank', 'other'].includes(account)) {
      return res.status(400).json({ error: 'Select a valid payment account' });
    }
    if (report === 'statement' && account && !['shop', 'cash', 'upi', 'bank', 'other'].includes(account)) {
      return res.status(400).json({ error: 'Select a valid statement account' });
    }

    const filter = { status: { $in: ['finalized', null] } };
    if (start || end) {
      filter.date = {};
      if (start) filter.date.$gte = start;
      if (end) filter.date.$lte = end;
    }
    const reportTypes = REPORTS[report];
    if (reportTypes) filter.type = { $in: reportTypes };
    if (partyId) filter.partyId = new mongoose.Types.ObjectId(partyId);
    if (account && report !== 'statement') filter.$or = [{ account }, { type: 'transfer', transferTo: account }, { [`paidByAccountPaise.${account}`]: { $gt: 0 } }];
    else if (report === 'accounts') filter.account = { $in: ['cash', 'upi', 'bank', 'other'] };
    if (category) filter.category = category;
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 50));
    const grouping = ['day', 'month', 'year', 'category', 'account', 'party', 'type'].includes(groupBy) ? groupBy : 'type';
    const saleInflow = account ? {
      $cond: [
        { $eq: ['$type', 'sale'] },
        {
          $cond: [
            { $eq: [{ $type: '$paidByAccountPaise' }, 'object'] },
            { $ifNull: [`$paidByAccountPaise.${account}`, 0] },
            { $cond: [{ $eq: ['$account', account] }, '$amountPaise', 0] }
          ]
        },
        { $cond: [{ $in: ['$type', ['customer_payment', 'other_receipt']] }, { $cond: [{ $eq: ['$account', account] }, '$amountPaise', 0] }, 0] }
      ]
    } : { $cond: [{ $in: ['$type', ['sale', 'customer_payment', 'other_receipt']] }, '$amountPaise', 0] };
    const purchaseOutflow = account ? {
      $cond: [
        { $eq: [{ $type: '$paidByAccountPaise' }, 'object'] },
        { $ifNull: [`$paidByAccountPaise.${account}`, 0] },
        { $cond: [{ $eq: ['$account', account] }, '$paidAmountPaise', 0] }
      ]
    } : '$paidAmountPaise';

    const [transactions, total, grouped] = await Promise.all([
      LedgerTransaction.find(filter).sort({ date: -1, createdAt: -1 }).skip((safePage - 1) * safeLimit).limit(safeLimit)
        .populate('partyId', 'name type phone')
        .populate('linkedTransactionId', 'date type amountPaise description')
        .lean(),
      LedgerTransaction.countDocuments(filter),
      LedgerTransaction.aggregate([
        { $match: filter },
        { $group: {
          _id: groupExpression(report === 'daily' ? 'day' : report === 'monthly' ? 'month' : report === 'yearly' ? 'year' : grouping),
          count: { $sum: 1 },
          totalPaise: { $sum: '$amountPaise' },
          paidPaise: { $sum: '$paidAmountPaise' },
          inflowPaise: { $sum: saleInflow },
          netSalesPaise: { $sum: {
            $cond: [
              { $in: ['$type', ['sale', 'credit_sale']] },
              '$amountPaise',
              { $cond: [{ $eq: ['$type', 'sales_refund'] }, { $multiply: ['$amountPaise', -1] }, 0] }
            ]
          } },
          outflowPaise: { $sum: {
            $cond: [
              { $in: ['$type', ['sales_refund', 'supplier_payment', 'expense', 'owner_withdrawal', 'owner_reimbursement', 'other_payment']] },
              '$amountPaise',
              { $cond: [{ $in: ['$type', ['supplier_purchase', 'market_purchase']] }, purchaseOutflow, 0] }
            ]
          } }
        } },
        { $sort: { _id: 1 } }
      ])
    ]);
    let statement = null;
    if (report === 'statement') {
      const statementFilter = { ...filter };
      delete statementFilter.$or;
      delete statementFilter.account;
      if (account) {
        const accounts = account === 'shop' ? ['cash', 'upi'] : [account];
        statementFilter.$or = [
          { account: { $in: accounts } },
          { type: 'transfer', transferTo: { $in: accounts } },
          ...accounts.map(name => ({ [`paidByAccountPaise.${name}`]: { $gt: 0 } }))
        ];
      }
      const includeOpeningBalanceHistory = !partyId && (!account || account === 'shop');
      const monthlyBalanceFilter = {
        ...(start || end ? { updatedAt: { ...(start ? { $gte: start } : {}), ...(end ? { $lte: end } : {}) } } : {})
      };
      const statementMonth = typeof req.query.from === 'string' && /^\d{4}-\d{2}-01$/.test(req.query.from)
        ? req.query.from.slice(0, 7)
        : '';
      const [accountSettings, priorTransactions, statementTotal, openingBalanceEvents, statementMonthlyOpening] = await Promise.all([
        LedgerAccount.find({}).lean(),
        start ? LedgerTransaction.find({
          $and: [
            { status: { $in: ['finalized', null] } },
            { date: { $lt: start } },
            { type: { $in: REPORTS.statement } }
          ],
        }).sort({ date: 1, createdAt: 1 }).lean() : Promise.resolve([]),
        LedgerTransaction.countDocuments(statementFilter),
        includeOpeningBalanceHistory
          ? LedgerMonthlyBalance.find(monthlyBalanceFilter).select('month openingBalancePaise updatedAt').lean()
          : Promise.resolve([]),
        account === 'shop' && statementMonth
          ? LedgerMonthlyBalance.findOne({ month: statementMonth }).select('openingBalancePaise').lean()
          : Promise.resolve(null)
      ]);
      const settingMap = new Map(accountSettings.map(item => [item.account, item]));
      const accountOpening = {};
      const accountStartDates = {};
      let incompleteHistory = false;
      for (const name of ['cash', 'upi', 'bank', 'other']) {
        const setting = settingMap.get(name);
        const effectiveFrom = setting?.openingBalanceDate || new Date(0);
        accountStartDates[name] = effectiveFrom;
        if (start && start < effectiveFrom) {
          accountOpening[name] = 0;
          incompleteHistory = true;
          continue;
        }
        const movementBeforePeriod = priorTransactions.filter(item => isAccountTransactionIncluded(item, effectiveFrom));
        accountOpening[name] = (setting?.openingBalancePaise || 0) +
          calculateAccountMovement(name, movementBeforePeriod);
      }
      const calculatedStatementOpeningBalancePaise = account === 'shop'
        ? accountOpening.cash + accountOpening.upi
        : account ? accountOpening[account] || 0 : Object.values(accountOpening).reduce((sum, balance) => sum + balance, 0);
      const openingBalancePaise = statementMonthlyOpening?.openingBalancePaise ?? calculatedStatementOpeningBalancePaise;
      const prefixTransactions = await LedgerTransaction.find(statementFilter)
        .sort({ date: 1, createdAt: 1 })
        .limit(safePage * safeLimit)
        .populate('partyId', 'name type phone')
        .lean();
      const openingBalanceEntries = openingBalanceEvents.map(item => ({
        _id: `monthly-opening-${item.month}`,
        type: 'monthly_opening_balance',
        date: item.updatedAt,
        createdAt: item.updatedAt,
        openingBalanceMonth: item.month,
        amountPaise: item.openingBalancePaise,
        description: `Manual opening balance saved for ${item.month}`,
        isOpeningBalanceSetting: true
      }));
      const statementActivities = [...prefixTransactions, ...openingBalanceEntries]
        .sort((a, b) => new Date(a.date) - new Date(b.date) || new Date(a.createdAt) - new Date(b.createdAt))
        .slice(0, safePage * safeLimit);
      let runningBalancePaise = openingBalancePaise;
      const entries = statementActivities.map(item => {
        if (item.isOpeningBalanceSetting) {
          return {
            ...item,
            statementAccount: account || 'shop',
            inflowPaise: 0,
            outflowPaise: 0,
            runningBalancePaise
          };
        }
        const movementFor = (name) => !isAccountTransactionIncluded(item, accountStartDates[name])
          ? 0
          : calculateAccountMovement(name, [item]);
        const movementPaise = account === 'shop'
          ? movementFor('cash') + movementFor('upi')
          : account ? movementFor(account) : ['cash', 'upi', 'bank', 'other'].reduce((sum, name) => sum + movementFor(name), 0);
        const inflowPaise = Math.max(0, movementPaise);
        const outflowPaise = Math.max(0, -movementPaise);
        runningBalancePaise += movementPaise;
        return {
          ...item,
          statementAccount: account || 'shop',
          inflowPaise,
          outflowPaise,
          runningBalancePaise
        };
      });
      const pageEntries = entries.slice((safePage - 1) * safeLimit);
      const pageOpeningBalancePaise = safePage > 1
        ? entries[(safePage - 1) * safeLimit - 1]?.runningBalancePaise ?? openingBalancePaise
        : openingBalancePaise;
      statement = {
        entries: pageEntries,
        openingBalancePaise: pageOpeningBalancePaise,
        closingBalancePaise: pageEntries.at(-1)?.runningBalancePaise ?? (
          safePage === 1 ? openingBalancePaise : entries.at(-1)?.runningBalancePaise ?? openingBalancePaise
        ),
        incompleteHistory,
        total: statementTotal + openingBalanceEvents.length
      };
    }
    const balanceEndMonth = nextMonthOf(req.query.to);
    const reportMonth = typeof req.query.from === 'string' ? req.query.from.slice(0, 7) : '';
    const reportMonthStart = reportMonth ? `${reportMonth}-01` : '';
    const [balanceAccounts, balanceTransactions, creditSales, reportOpening, nextMonthOpening] = await Promise.all([
      LedgerAccount.find({ account: { $in: ['cash', 'upi'] } }).lean(),
      LedgerTransaction.find({
        status: { $in: ['finalized', null] },
        type: { $in: REPORTS.statement },
        ...(end ? { date: { $lte: end } } : {})
      }).select('status type account transferTo amountPaise paidAmountPaise paidByAccountPaise date createdAt').lean(),
      LedgerTransaction.aggregate([
        {
          $match: {
            status: { $in: ['finalized', null] },
            type: 'credit_sale',
            ...(start || end ? { date: { ...(start ? { $gte: start } : {}), ...(end ? { $lte: end } : {}) } } : {})
          }
        },
        { $group: { _id: null, totalPaise: { $sum: '$amountPaise' } } }
      ]),
      reportMonthStart && req.query.from === reportMonthStart
        ? LedgerMonthlyBalance.findOne({ month: reportMonth }).lean()
        : Promise.resolve(null),
      balanceEndMonth ? LedgerMonthlyBalance.findOne({ month: balanceEndMonth }).lean() : Promise.resolve(null)
    ]);

    const accountSettings = new Map(balanceAccounts.map(item => [item.account, item]));
    let calculatedOpeningBalancePaise = 0;
    let periodMovementPaise = 0;
    let cashInflowPaise = 0;
    let cashOutflowPaise = 0;
    let incompleteBalanceHistory = false;
    for (const name of ['cash', 'upi']) {
      const setting = accountSettings.get(name);
      const baseBalance = setting?.openingBalancePaise || 0;
      const effectiveFrom = setting?.openingBalanceDate || new Date(0);
      if (start && start < effectiveFrom) incompleteBalanceHistory = true;
      const includedTransactions = balanceTransactions.filter(item => isAccountTransactionIncluded(item, effectiveFrom));
      const priorTransactions = start
        ? includedTransactions.filter(item => new Date(item.date) < start)
        : [];
      const periodTransactions = includedTransactions.filter(item =>
        (!start || new Date(item.date) >= start) && (!end || new Date(item.date) <= end)
      );
      for (const item of periodTransactions) {
        const accountSplit = item.paidByAccountPaise || {};
        const hasSplit = item.paidByAccountPaise != null;
        if (item.type === 'sale') {
          cashInflowPaise += hasSplit
            ? accountSplit[name] || 0
            : item.account === name ? item.amountPaise : 0;
        } else if (['customer_payment', 'other_receipt'].includes(item.type) && item.account === name) {
          cashInflowPaise += item.amountPaise;
        }
        if (['sales_refund', 'supplier_payment', 'expense', 'owner_withdrawal', 'owner_reimbursement', 'other_payment'].includes(item.type) && item.account === name) {
          cashOutflowPaise += item.amountPaise;
        }
        if (['supplier_purchase', 'market_purchase'].includes(item.type)) {
          cashOutflowPaise += hasSplit
            ? accountSplit[name] || 0
            : item.account === name ? item.paidAmountPaise || 0 : 0;
        }
      }
      calculatedOpeningBalancePaise += start && start < effectiveFrom
        ? 0
        : baseBalance + calculateAccountMovement(name, priorTransactions);
      periodMovementPaise += calculateAccountMovement(name, periodTransactions);
    }
    const openingBalancePaise = reportOpening?.openingBalancePaise ?? calculatedOpeningBalancePaise;
    const nextMonthValue = balanceEndMonth ? nextMonthOpening?.openingBalancePaise ?? null : null;
    const balanceSummary = {
      openingBalancePaise,
      calculatedOpeningBalancePaise,
      cashInflowPaise,
      cashOutflowPaise,
      movementPaise: periodMovementPaise,
      closingBalancePaise: openingBalancePaise + periodMovementPaise,
      creditSalesPaise: creditSales[0]?.totalPaise || 0,
      manualOpeningBalanceApplied: Boolean(reportOpening),
      incompleteHistory: incompleteBalanceHistory,
      nextMonth: balanceEndMonth,
      nextMonthOpeningBalancePaise: nextMonthValue,
      from: typeof req.query.from === 'string' ? req.query.from : null,
      to: typeof req.query.to === 'string' ? req.query.to : null
    };
    let partyBalances = [];
    if (report === 'customer' || report === 'supplier') {
      const partyFilter = { type: report };
      if (partyId) partyFilter._id = new mongoose.Types.ObjectId(partyId);
      const matchingParties = await LedgerParty.find(partyFilter).sort({ name: 1 }).lean();
      const partyIds = matchingParties.map(party => party._id);
      const partyTransactions = partyIds.length ? await LedgerTransaction.find({
        partyId: { $in: partyIds },
        status: { $in: ['finalized', null] }
      }).sort({ date: 1, createdAt: 1 }).lean() : [];
      const byParty = new Map();
      for (const transaction of partyTransactions) {
        const key = String(transaction.partyId);
        if (!byParty.has(key)) byParty.set(key, []);
        byParty.get(key).push(transaction);
      }
      partyBalances = matchingParties.map(party => {
        const balance = report === 'customer'
          ? calculateCustomerLedger(party.openingBalancePaise, byParty.get(String(party._id)) || [])
          : calculateSupplierOutstanding(party.openingBalancePaise, byParty.get(String(party._id)) || []);
        return { partyId: party._id, name: party.name, phone: party.phone, openingBalancePaise: party.openingBalancePaise, outstandingPaise: Math.max(0, balance.outstandingPaise), advancePaise: report === 'customer' ? Math.max(0, balance.advancePaise) : 0 };
      });
    }
    const result = {
      report, groupBy: report === 'daily' ? 'day' : report === 'monthly' ? 'month' : report === 'yearly' ? 'year' : grouping,
      rows: grouped, transactions: report === 'statement' ? statement.entries : transactions,
      total: report === 'statement' ? statement.total : total, page: safePage, limit: safeLimit, partyBalances, statement, balanceSummary,
      profitAvailable: false,
      profitWarning: 'Cost of goods sold, returns and discount data are not yet part of the standalone ledger, so profit cannot be calculated reliably.'
    };
    return res.status(200).json(result);
  } catch (error) {
    console.error('ledger report failed', error);
    return res.status(500).json({ error: 'Unable to generate ledger report' });
  }
}
