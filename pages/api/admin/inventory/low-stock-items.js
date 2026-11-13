import { getSession } from 'next-auth/react';
import dbConnect from '@/lib/mongodb';
import Product from '@/models/Product';

export default async function handler(req, res){
  await dbConnect();
  const session = await getSession({ req });
  if(!session || session.user.role !== 'admin') return res.status(401).json({ error: 'Unauthorized' });

  try{
    const items = await Product.find({ $expr: { $lt: ['$stock', { $ifNull: ['$minStockLevel', 0] }] } }).sort({ stock: 1 }).limit(50).lean();
    const mapped = (items || []).map(i => ({ id: i._id, name: i.title, sku: i.sku, stock: i.stock, minStockLevel: i.minStockLevel }));
    return res.json({ items: mapped });
  }catch(e){ console.error('low-stock items failed', e); return res.status(500).json({ error: 'internal' }); }
}
