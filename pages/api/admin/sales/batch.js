import { getSession } from 'next-auth/react';
import dbConnect from '@/lib/mongodb';
import mongoose from 'mongoose';
import Inventory from '@/models/Inventory';
import Sale from '@/models/Sale';
import pusher from '@/lib/pusher';

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
  for(const row of items){
    try{
      const { itemId, sellingPrice, quantity, note } = row;
      const qty = parseInt(quantity, 10) || 0;
      if(!itemId || qty <= 0) { results.push({ ok: false, error: 'invalid row', row }); continue; }

      // load item
      const item = await Inventory.findById(itemId).lean();
      if(!item){ results.push({ ok: false, error: 'item not found', row }); continue; }
      if((item.stock || 0) < qty){ results.push({ ok: false, error: 'insufficient stock', row }); continue; }

      const costPrice = Number(item.costPrice ? item.costPrice.toString() : 0);
      const sp = Number(sellingPrice || 0);
      const profit = (sp - costPrice) * qty;

      // atomically decrement stock
      const updated = await Inventory.findOneAndUpdate({ _id: itemId, stock: { $gte: qty } }, { $inc: { stock: -qty } }, { new: true }).lean();
      if(!updated){ results.push({ ok: false, error: 'insufficient stock (concurrent)', row }); continue; }

      // update lifetimeProfit
      try{
        const currentLifetime = Number(updated.lifetimeProfit ? updated.lifetimeProfit.toString() : 0);
        const newLifetime = currentLifetime + profit;
        await Inventory.findByIdAndUpdate(itemId, { $set: { lifetimeProfit: mongoose.Types.Decimal128.fromString(newLifetime.toFixed(2)) } });
      }catch(e){ console.warn('lifetimeProfit update failed', e); }

      // create sale
      const sale = await Sale.create({ itemId, sku: item.sku, name: item.name, costPrice: mongoose.Types.Decimal128.fromString(costPrice.toFixed(2)), sellingPrice: mongoose.Types.Decimal128.fromString(sp.toFixed(2)), quantity: qty, profit: mongoose.Types.Decimal128.fromString(profit.toFixed(2)), actorId: session.user.id, timestamp: new Date(), note, source: 'admin' });

      // broadcast
      try{ await pusher.trigger('inventory', 'inventory.update', { id: itemId, stock: updated.stock, lowStock: updated.stock < (updated.minStockLevel||0) }); }catch(e){/* ignore */}

      const saleObj = sale.toObject ? sale.toObject() : sale;
      saleObj.costPrice = Number(saleObj.costPrice.toString());
      saleObj.sellingPrice = Number(saleObj.sellingPrice.toString());
      saleObj.profit = Number(saleObj.profit.toString());

      const inv = { ...updated, costPrice: Number(updated.costPrice ? updated.costPrice.toString() : 0), sellingPrice: Number(updated.sellingPrice ? updated.sellingPrice.toString() : 0), lifetimeProfit: Number(updated.lifetimeProfit ? updated.lifetimeProfit.toString() : 0) };

      results.push({ ok: true, sale: saleObj, inventory: inv });
    }catch(e){ console.error('batch row failed', e); results.push({ ok: false, error: 'internal' }); }
  }

  return res.json({ results });
}
