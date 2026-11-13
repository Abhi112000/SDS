import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';
import { getLedgerAdmin } from '@/lib/ledger-auth';
import LedgerExpenseCategory from '@/models/LedgerExpenseCategory';

const DEFAULT_CATEGORIES = [
  'Auto', 'Bus', 'Metro', 'Petrol', 'Parking', 'Loading and unloading',
  'Delivery', 'Shop rent', 'Electricity', 'Packaging', 'Maintenance',
  'Repairing work', 'Racks and fixtures', 'Shop development',
  'Bank charges', 'Miscellaneous'
];

function normalizedName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

export default async function handler(req, res) {
  await dbConnect();
  const admin = await getLedgerAdmin(req);
  if (!admin) return res.status(403).json({ error: 'admin required' });

  if (req.method === 'GET') {
    try {
      await LedgerExpenseCategory.bulkWrite(DEFAULT_CATEGORIES.map(name => ({
        updateOne: { filter: { normalizedName: normalizedName(name) }, update: { $setOnInsert: { name, normalizedName: normalizedName(name) } }, upsert: true }
      })));
      const categories = await LedgerExpenseCategory.find({}).sort({ active: -1, name: 1 }).lean();
      return res.status(200).json({ categories });
    } catch (error) {
      console.error('ledger expense category listing failed', error);
      return res.status(500).json({ error: 'Unable to load expense categories' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { name } = req.body || {};
      const cleaned = String(name || '').trim().replace(/\s+/g, ' ');
      if (!cleaned || cleaned.length > 80) return res.status(400).json({ error: 'Category name is required and must be under 80 characters' });
      const category = await LedgerExpenseCategory.create({
        name: cleaned, normalizedName: normalizedName(cleaned), createdBy: String(admin.id || '')
      });
      return res.status(201).json({ category });
    } catch (error) {
      if (error?.code === 11000) return res.status(409).json({ error: 'That expense category already exists' });
      console.error('ledger expense category creation failed', error);
      return res.status(500).json({ error: 'Unable to create expense category' });
    }
  }

  if (req.method === 'PATCH') {
    try {
      const { id, active } = req.body || {};
      if (!mongoose.isValidObjectId(id) || typeof active !== 'boolean') return res.status(400).json({ error: 'Valid category id and active status are required' });
      const category = await LedgerExpenseCategory.findByIdAndUpdate(id, { $set: { active } }, { new: true }).lean();
      if (!category) return res.status(404).json({ error: 'Expense category not found' });
      return res.status(200).json({ category });
    } catch (error) {
      console.error('ledger expense category update failed', error);
      return res.status(500).json({ error: 'Unable to update expense category' });
    }
  }

  res.setHeader('Allow', 'GET, POST, PATCH');
  return res.status(405).json({ error: 'Method not allowed' });
}
