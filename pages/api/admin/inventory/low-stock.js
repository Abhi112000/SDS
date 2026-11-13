import { getSession } from 'next-auth/react';
import dbConnect from '@/lib/mongodb';
import Product from '@/models/Product';

export default async function handler(req, res){
  await dbConnect();
  const session = await getSession({ req });
  if(!session || session.user.role !== 'admin') return res.status(401).json({ error: 'Unauthorized' });

  try{
    // count items where stock < minStockLevel
    const count = await Product.countDocuments({ $expr: { $lt: ['$stock', { $ifNull: ['$minStockLevel', 0] }] } });
    return res.json({ count });
  }catch(e){ console.error('low-stock count failed', e); return res.status(500).json({ error: 'internal' }); }
}
