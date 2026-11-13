import { getSession } from 'next-auth/react';
import dbConnect from '@/lib/mongodb';
import mongoose from 'mongoose';
import Product from '@/models/Product';
import pusher from '@/lib/pusher';
import { recordSale } from '@/lib/recordSale';

// Batch processing: accepts { items: [{ itemId, sellingPrice, quantity, note }] }
// Processes each row sequentially and returns per-row result { ok, error, sale?, inventory? }
export default async function handler(req, res){
  await dbConnect();
  const session = await getSession({ req });
  if(!session || session.user.role !== 'admin') return res.status(401).json({ error: 'Unauthorized' });
  if(req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { items } = req.body;
  if(!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'items required' });

  const results = [];
  for(let index = 0; index < items.length; index += 1){
    const row = items[index];
    try{
      const { itemId, sku, sellingPrice, quantity, note } = row || {};
      if(Boolean(itemId) === Boolean(sku)) throw new Error('Provide either itemId or SKU');
      let item;
      if(itemId) {
        if(!mongoose.Types.ObjectId.isValid(itemId)) throw new Error('Invalid itemId');
        item = await Product.findById(itemId).lean();
      } else {
        const matches = await Product.find({ sku: new RegExp(`^${String(sku).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }).limit(2).lean();
        if(matches.length > 1) throw new Error('SKU matches multiple products; use itemId');
        item = matches[0];
      }
      if(!item) throw new Error('Product not found');
      const { sale, product } = await recordSale({ product: item, sellingPrice, quantity, actorId: session.user.id, note });
      try{ await pusher.trigger('inventory', 'inventory.update', { id: String(product._id), stock: product.stock, lowStock: product.stock < (product.minStockLevel || 0) }); }catch(e){ console.warn('inventory update notification failed', e?.message || e); }
      const saleObj = sale.toObject();
      saleObj.costPrice = Number(saleObj.costPrice.toString());
      saleObj.sellingPrice = Number(saleObj.sellingPrice.toString());
      saleObj.profit = Number(saleObj.profit.toString());
      results.push({ row: index + 1, ok: true, sale: saleObj, inventory: product });
    }catch(e){ console.error('batch row failed', e); results.push({ row: index + 1, ok: false, error: e.message || 'Unable to record sale' }); }
  }

  return res.json({ results, succeeded: results.filter(result => result.ok).length, failed: results.filter(result => !result.ok).length });
}
