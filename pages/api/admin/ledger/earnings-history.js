import dbConnect from '@/lib/mongodb';
import { getLedgerAdmin } from '@/lib/ledger-auth';
import LedgerTransaction from '@/models/LedgerTransaction';
import LedgerMonthlyBalance from '@/models/LedgerMonthlyBalance';

function monthStartUtc(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(Date.UTC(year, monthNumber - 1, 1) - 330 * 60 * 1000);
}

function isValidMonth(value) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(value || ''));
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
    const filter = { type: { $in: ['sale', 'credit_sale'] }, status: { $in: ['finalized', null] } };
    const [earnedMonths, savedBalances] = await Promise.all([
      LedgerTransaction.aggregate([
        { $match: filter },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$date', timezone: 'Asia/Kolkata' } },
            totalPaise: { $sum: '$amountPaise' },
            salePaise: { $sum: { $cond: [{ $eq: ['$type', 'sale'] }, '$amountPaise', 0] } },
            creditPaise: { $sum: { $cond: [{ $eq: ['$type', 'credit_sale'] }, '$amountPaise', 0] } },
            count: { $sum: 1 }
          }
        }
      ]),
      LedgerMonthlyBalance.find({}).select('month openingBalancePaise').lean()
    ]);
    const monthMap = new Map(earnedMonths.map(item => [item._id, item]));
    for (const balance of savedBalances) {
      const monthData = monthMap.get(balance.month) || {
        _id: balance.month,
        totalPaise: 0,
        salePaise: 0,
        creditPaise: 0,
        count: 0
      };
      monthData.openingBalancePaise = balance.openingBalancePaise;
      monthMap.set(balance.month, monthData);
    }
    const monthly = [...monthMap.values()].sort((a, b) => b._id.localeCompare(a._id));

    const month = String(req.query.month || '');
    if (!month) return res.status(200).json({ months: monthly });
    if (!isValidMonth(month)) return res.status(400).json({ error: 'Select a valid month' });

    const start = monthStartUtc(month);
    const [year, monthNumber] = month.split('-').map(Number);
    const end = new Date(Date.UTC(year, monthNumber, 1) - 330 * 60 * 1000);
    const monthFilter = { ...filter, date: { $gte: start, $lt: end } };
    const days = await LedgerTransaction.aggregate([
      { $match: monthFilter },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: 'Asia/Kolkata' } },
          totalPaise: { $sum: '$amountPaise' },
          salePaise: { $sum: { $cond: [{ $eq: ['$type', 'sale'] }, '$amountPaise', 0] } },
          creditPaise: { $sum: { $cond: [{ $eq: ['$type', 'credit_sale'] }, '$amountPaise', 0] } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100));
    const [items, total] = await Promise.all([
      LedgerTransaction.find(monthFilter)
        .sort({ date: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('partyId', 'name')
        .lean(),
      LedgerTransaction.countDocuments(monthFilter)
    ]);

    return res.status(200).json({
      months: monthly,
      month,
      days,
      items,
      total,
      page,
      limit
    });
  } catch (error) {
    console.error('ledger earnings history failed:', error);
    return res.status(500).json({ error: 'Unable to load monthly earnings history' });
  }
}
