import { getSession } from 'next-auth/react';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';
import Inventory from '@/models/Inventory';
import Category from '@/models/Category';

export default async function handler(req, res){
  await dbConnect();
  const session = await getSession({ req });
  if(!session || session.user.role !== 'admin') return res.status(401).json({ error: 'Unauthorized' });

  if(req.method === 'GET'){
    try{
      const { q, category, page = 1, limit = 50 } = req.query;
      const filter = {};
      if(q){
        // Prefer anchored prefix search so Mongo can use indexes when possible.
        const esc = String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const prefRegex = new RegExp('^' + esc, 'i');
        filter.$or = [{ name: prefRegex }, { sku: prefRegex }];
      }
      if(category) filter.category = category;
      const skip = (Number(page) - 1) * Number(limit);
  // limit returned fields for speed
  const items = await Inventory.find(filter).sort({ name: 1 }).skip(skip).limit(Number(limit)).lean();
      const total = await Inventory.countDocuments(filter);
      // convert Decimal128 monetary fields to numbers for the API
      // enrich with category name when available
      const categoryIds = Array.from(new Set(items.map(it => it.category).filter(Boolean)));
      const cats = categoryIds.length ? await Category.find({ _id: { $in: categoryIds } }).lean() : [];
      const catMap = {};
      for(const c of cats) catMap[String(c._id)] = c.name || '';
      const cleaned = items.map(i => ({
        ...i,
        categoryName: i.category ? (catMap[String(i.category)] || i.category) : '',
        costPrice: i.costPrice ? Number(i.costPrice.toString()) : 0,
        sellingPrice: i.sellingPrice ? Number(i.sellingPrice.toString()) : 0,
        lifetimeProfit: i.lifetimeProfit ? Number(i.lifetimeProfit.toString()) : 0
      }));
      return res.json({ items: cleaned, total, page: Number(page), limit: Number(limit) });
    }catch(e){ console.error(e); return res.status(500).json({ error: 'internal' }); }
  }

  if(req.method === 'PUT'){
    try{
      const { id, costPrice, sellingPrice, minStockLevel } = req.body;
      if(!id) return res.status(400).json({ error: 'id required' });
  const update = {};
  if(typeof costPrice !== 'undefined') update.costPrice = mongoose.Types.Decimal128.fromString(Number(costPrice).toFixed(2));
  if(typeof sellingPrice !== 'undefined') update.sellingPrice = mongoose.Types.Decimal128.fromString(Number(sellingPrice).toFixed(2));
  if(typeof minStockLevel !== 'undefined') update.minStockLevel = Number(minStockLevel);
  const updated = await Inventory.findByIdAndUpdate(id, update, { new: true }).lean();
      if(!updated) return res.status(404).json({ error: 'not found' });
  // convert Decimal128 fields for response
  const itemOut = { ...updated, costPrice: updated.costPrice ? Number(updated.costPrice.toString()) : 0, sellingPrice: updated.sellingPrice ? Number(updated.sellingPrice.toString()) : 0, lifetimeProfit: updated.lifetimeProfit ? Number(updated.lifetimeProfit.toString()) : 0 };
  return res.json({ item: itemOut });
    }catch(e){ console.error(e); return res.status(500).json({ error: 'internal' }); }
  }

  res.setHeader('Allow', 'GET, PUT');
  return res.status(405).json({ error: 'Method not allowed' });
}
