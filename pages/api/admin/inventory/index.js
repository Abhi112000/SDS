import { getSession } from 'next-auth/react';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';
import Product from '@/models/Product';
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
        const esc = String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const prefRegex = new RegExp('^' + esc, 'i');
        filter.$or = [{ title: prefRegex }, { sku: prefRegex }];
      }
      if(category) filter.category = category;
      const pageNumber = Math.max(1, Number(page) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(limit) || 50));
      const skip = (pageNumber - 1) * pageSize;
      const items = await Product.find(filter).sort({ title: 1 }).skip(skip).limit(pageSize).lean();
      const total = await Product.countDocuments(filter);
      const categoryIds = Array.from(new Set(items.map(it => it.category).filter(Boolean)));
      const validCategoryIds = categoryIds.filter(id => mongoose.Types.ObjectId.isValid(id));
      const cats = validCategoryIds.length ? await Category.find({ _id: { $in: validCategoryIds } }).lean() : [];
      const catMap = {};
      for(const c of cats) catMap[String(c._id)] = c.name || '';
      const cleaned = items.map(i => ({
        ...i,
        id: i._id,
        name: i.title,
        categoryName: i.category ? (catMap[String(i.category)] || i.category) : '',
        costPrice: Number(i.originalPrice || 0),
        sellingPrice: Number(i.salePrice !== undefined && (i.onSale || i.tags?.includes('SALE!')) ? i.salePrice : i.price || 0),
        lifetimeProfit: Number(i.lifetimeProfit || 0),
        minStockLevel: Number(i.minStockLevel || 0)
      }));
      return res.json({ items: cleaned, total, page: pageNumber, limit: pageSize });
    }catch(e){ console.error(e); return res.status(500).json({ error: 'internal' }); }
  }

  if(req.method === 'PUT'){
    try{
      const { id, costPrice, sellingPrice, minStockLevel } = req.body;
      if(!id) return res.status(400).json({ error: 'id required' });
      const update = {};
      if(typeof costPrice !== 'undefined') update.originalPrice = Number(costPrice);
      if(typeof sellingPrice !== 'undefined') update.price = Number(sellingPrice);
      if(typeof minStockLevel !== 'undefined') update.minStockLevel = Number(minStockLevel);
      for(const value of Object.values(update)){
        if(!Number.isFinite(value) || value < 0) return res.status(400).json({ error: 'Inventory values must be non-negative numbers' });
      }
      const updated = await Product.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
      if(!updated) return res.status(404).json({ error: 'not found' });
      const itemOut = { ...updated, name: updated.title, costPrice: Number(updated.originalPrice || 0), sellingPrice: Number(updated.price || 0), lifetimeProfit: Number(updated.lifetimeProfit || 0) };
      return res.json({ item: itemOut });
    }catch(e){ console.error(e); return res.status(500).json({ error: 'internal' }); }
  }

  res.setHeader('Allow', 'GET, PUT');
  return res.status(405).json({ error: 'Method not allowed' });
}
