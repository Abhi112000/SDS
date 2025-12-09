import { getSession } from 'next-auth/react';
import dbConnect from '@/lib/mongodb';
import Inventory from '@/models/Inventory';

export default async function handler(req, res){
  await dbConnect();
  const session = await getSession({ req });
  if(!session || session.user.role !== 'admin') return res.status(401).json({ error: 'Unauthorized' });

  try{
    const items = await Inventory.find({ $expr: { $lt: ['$stock', '$minStockLevel'] } }).sort({ stock: 1 }).limit(50).lean();
    const mapped = (items || []).map(i => ({ id: i._id, name: i.name, sku: i.sku, stock: i.stock, minStockLevel: i.minStockLevel }));
    return res.json({ items: mapped });
  }catch(e){ console.error('low-stock items failed', e); return res.status(500).json({ error: 'internal' }); }
}
