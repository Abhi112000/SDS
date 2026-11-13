import dbConnect from '@/lib/mongodb';
import { getLedgerAdmin } from '@/lib/ledger-auth';
import LedgerMonthlyBalance from '@/models/LedgerMonthlyBalance';
import { toPaise } from '@/lib/ledger';

const VALID_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export default async function handler(req, res) {
  await dbConnect();
  const admin = await getLedgerAdmin(req);
  if (!admin) return res.status(403).json({ error: 'admin required' });

  if (req.method === 'GET') {
    try {
      const { month } = req.query;
      if (month === undefined) {
        const balances = await LedgerMonthlyBalance.find({})
          .sort({ month: -1 })
          .select('month openingBalancePaise note updatedAt')
          .lean();
        return res.status(200).json({ balances });
      }
      if (typeof month !== 'string' || !VALID_MONTH.test(month)) {
        return res.status(400).json({ error: 'Select a valid month' });
      }
      const balance = await LedgerMonthlyBalance.findOne({ month }).lean();
      return res.status(200).json({ balance });
    } catch (error) {
      console.error('ledger monthly opening balance load failed', error);
      return res.status(500).json({ error: 'Unable to load monthly opening balance' });
    }
  }

  if (req.method === 'PUT') {
    try {
      const { month, amount, note = '' } = req.body || {};
      if (typeof month !== 'string' || !VALID_MONTH.test(month)) {
        return res.status(400).json({ error: 'Select a valid month' });
      }
      const openingBalancePaise = toPaise(amount);
      if (!Number.isSafeInteger(openingBalancePaise)) {
        return res.status(400).json({ error: 'Enter a valid opening balance with up to two decimals' });
      }
      const actorId = String(admin.id || '');
      const balance = await LedgerMonthlyBalance.findOneAndUpdate(
        { month },
        {
          $set: {
            openingBalancePaise,
            note: String(note).trim().slice(0, 500),
            updatedBy: actorId,
            updatedAt: new Date()
          },
          $setOnInsert: { month, createdBy: actorId }
        },
        { new: true, upsert: true, runValidators: true }
      ).lean();
      return res.status(200).json({ balance });
    } catch (error) {
      console.error('ledger monthly opening balance save failed', error);
      return res.status(500).json({ error: 'Unable to save monthly opening balance' });
    }
  }

  res.setHeader('Allow', 'GET, PUT');
  return res.status(405).json({ error: 'Method not allowed' });
}
