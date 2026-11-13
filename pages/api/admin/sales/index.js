import { getSession } from 'next-auth/react';
import { getToken } from 'next-auth/jwt';
import dbConnect from '@/lib/mongodb';
import mongoose from 'mongoose';
import Product from '@/models/Product';
import Sale from '@/models/Sale';
import pusher from '@/lib/pusher';
import { recordSale } from '@/lib/recordSale';

export default async function handler(req, res){
  await dbConnect();
  let session = await getSession({ req });
  // fallback to JWT token if session fetch fails (helps client-fetch issues)
  let token = null;
  if(!session){
    try{ token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET }); }catch(e){ token = null; }
  }
  const role = session?.user?.role || token?.role;
  const userId = session?.user?.id || token?.sub;
  if(!role || role !== 'admin') return res.status(401).json({ error: 'Unauthorized - admin required' });

  if(req.method === 'POST'){
    try{
      const { itemId, sellingPrice, quantity, timestamp, note } = req.body;
      if(!itemId) return res.status(400).json({ error: 'itemId required' });
      if(!mongoose.Types.ObjectId.isValid(itemId)) return res.status(400).json({ error: 'Invalid itemId' });
      const item = await Product.findById(itemId).lean();
      if(!item) return res.status(404).json({ error: 'Item not found' });
      const { sale, product } = await recordSale({ product: item, sellingPrice, quantity, actorId: userId, timestamp, note });
      try{ await pusher.trigger('inventory', 'inventory.update', { id: String(product._id), stock: product.stock, lowStock: product.stock < (product.minStockLevel || 0) }); }catch(e){ console.warn('inventory update notification failed', e?.message || e); }
      const saleObj = sale.toObject();
      saleObj.costPrice = Number(saleObj.costPrice.toString());
      saleObj.sellingPrice = Number(saleObj.sellingPrice.toString());
      saleObj.profit = Number(saleObj.profit.toString());
      return res.status(201).json({ sale: saleObj, inventory: product });
    }catch(e){
      console.error('create sale failed', e);
      if(e.message === 'Insufficient stock') return res.status(409).json({ error: e.message });
      if(e.message?.startsWith('Quantity') || e.message?.startsWith('Selling price')) return res.status(400).json({ error: e.message });
      return res.status(500).json({ error: 'Unable to record sale atomically' });
    }
  }
  // Support listing sales for admin via GET
  if(req.method === 'GET'){
    try{
      const { q, page = 1, limit = 50, itemId, from, to } = req.query;
      // If a query `q` is provided, behave like the inventory search endpoint so clients
      // can call /api/admin/sales?q=... and reuse the same quick-search behavior.
      if(q){
        const filter = {};
        const esc = String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const prefRegex = new RegExp('^' + esc, 'i');
        filter.$or = [{ title: prefRegex }, { sku: prefRegex }];
        const skip = (Number(page) - 1) * Number(limit);
        const items = await Product.find(filter).sort({ title: 1 }).skip(skip).limit(Number(limit)).lean();
        const total = await Product.countDocuments(filter);
        const cleaned = items.map(i => ({
          ...i,
          id: i._id,
          name: i.title,
          costPrice: Number(i.originalPrice || 0),
          sellingPrice: Number(i.salePrice !== undefined && (i.onSale || i.tags?.includes('SALE!')) ? i.salePrice : i.price || 0),
          lifetimeProfit: Number(i.lifetimeProfit || 0)
        }));
        return res.json({ items: cleaned, total, page: Number(page), limit: Number(limit) });
      }

      const filter = {};
      if(itemId) filter.itemId = itemId;
      if(from || to){
        filter.timestamp = {};
        if(from) filter.timestamp.$gte = new Date(from);
        if(to) filter.timestamp.$lte = new Date(to);
      }
      const skip = (Number(page) - 1) * Number(limit);
      const docs = await Sale.find(filter).sort({ timestamp: -1 }).skip(skip).limit(Number(limit)).lean();
      const total = await Sale.countDocuments(filter);
      // convert Decimal128 fields
      const items = docs.map(d => ({
        ...d,
        costPrice: d.costPrice ? Number(d.costPrice.toString()) : 0,
        sellingPrice: d.sellingPrice ? Number(d.sellingPrice.toString()) : 0,
        profit: d.profit ? Number(d.profit.toString()) : 0
      }));
      return res.json({ items, total, page: Number(page), limit: Number(limit) });
    }catch(e){ console.error(e); return res.status(500).json({ error: 'internal' }); }
  }

  // For other methods, return 405
  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}
