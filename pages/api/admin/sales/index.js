import { getSession } from 'next-auth/react';
import { getToken } from 'next-auth/jwt';
import dbConnect from '@/lib/mongodb';
import mongoose from 'mongoose';
import Inventory from '@/models/Inventory';
import Sale from '@/models/Sale';
import pusher from '@/lib/pusher';

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
      const qty = parseInt(quantity, 10) || 0;
      if(qty <= 0) return res.status(400).json({ error: 'quantity must be > 0' });
  const sellPrice = Number(sellingPrice || 0);

  // load inventory item
  const item = await Inventory.findById(itemId).lean();
      if(!item) return res.status(404).json({ error: 'Item not found' });
      if((item.stock || 0) < qty) return res.status(409).json({ error: 'Insufficient stock' });

  // item.costPrice and sellingPrice stored as Decimal128; parse to Number for math
  const costPrice = Number(item.costPrice ? item.costPrice.toString() : 0);
  const profit = (sellPrice - costPrice) * qty; // number

      // try atomic decrement: only decrement if sufficient stock remains
      // atomically decrement stock only
      const updated = await Inventory.findOneAndUpdate(
        { _id: itemId, stock: { $gte: qty } },
        { $inc: { stock: -qty } },
        { new: true }
      ).lean();

      if(!updated) return res.status(409).json({ error: 'Insufficient stock (concurrent)' });

      // update lifetimeProfit safely by computing new value and setting Decimal128
      try{
        const currentLifetime = Number(updated.lifetimeProfit ? updated.lifetimeProfit.toString() : 0);
        const newLifetime = currentLifetime + profit;
        await Inventory.findByIdAndUpdate(itemId, { $set: { lifetimeProfit: mongoose.Types.Decimal128.fromString(newLifetime.toFixed(2)) } });
      }catch(e){ console.warn('failed to update lifetimeProfit', e); }

      // create sale record with Decimal128 monetary fields
      const sale = await Sale.create({
        itemId,
        sku: item.sku,
        name: item.name,
        costPrice: mongoose.Types.Decimal128.fromString(costPrice.toFixed(2)),
        sellingPrice: mongoose.Types.Decimal128.fromString(sellPrice.toFixed(2)),
        quantity: qty,
        profit: mongoose.Types.Decimal128.fromString(profit.toFixed(2)),
        actorId: userId,
        timestamp: timestamp ? new Date(timestamp) : new Date(),
        note,
        source: 'admin'
      });

      // broadcast update
      try{ await pusher.trigger('inventory', 'inventory.update', { id: itemId, stock: updated.stock, lowStock: updated.stock < (updated.minStockLevel||0) }); }catch(e){/* ignore */}

      // convert Decimal128 fields to numbers for response
      const saleObj = sale.toObject ? sale.toObject() : sale;
      saleObj.costPrice = Number(saleObj.costPrice.toString());
      saleObj.sellingPrice = Number(saleObj.sellingPrice.toString());
      saleObj.profit = Number(saleObj.profit.toString());

      const inv = { ...updated };
      inv.costPrice = Number(inv.costPrice ? inv.costPrice.toString() : 0);
      inv.sellingPrice = Number(inv.sellingPrice ? inv.sellingPrice.toString() : 0);
      inv.lifetimeProfit = Number(inv.lifetimeProfit ? inv.lifetimeProfit.toString() : 0);

      return res.status(201).json({ sale: saleObj, inventory: inv });
    }catch(e){
      console.error('create sale failed', e);
      return res.status(500).json({ error: 'internal_error' });
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
        filter.$or = [{ name: prefRegex }, { sku: prefRegex }];
        const skip = (Number(page) - 1) * Number(limit);
        const items = await Inventory.find(filter).sort({ name: 1 }).skip(skip).limit(Number(limit)).lean();
        const total = await Inventory.countDocuments(filter);
        // convert Decimal128 and enrich category name if possible
        const cleaned = items.map(i => ({
          ...i,
          costPrice: i.costPrice ? Number(i.costPrice.toString()) : 0,
          sellingPrice: i.sellingPrice ? Number(i.sellingPrice.toString()) : 0,
          lifetimeProfit: i.lifetimeProfit ? Number(i.lifetimeProfit.toString()) : 0
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
