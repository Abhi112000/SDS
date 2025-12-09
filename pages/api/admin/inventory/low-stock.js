import { getSession } from 'next-auth/react';
import dbConnect from '@/lib/mongodb';
import Inventory from '@/models/Inventory';

export default async function handler(req, res){
  await dbConnect();
  const session = await getSession({ req });
  if(!session || session.user.role !== 'admin') return res.status(401).json({ error: 'Unauthorized' });

  try{
    // count items where stock < minStockLevel
    const count = await Inventory.countDocuments({ $expr: { $lt: ['$stock', '$minStockLevel'] } });
    return res.json({ count });
  }catch(e){ console.error('low-stock count failed', e); return res.status(500).json({ error: 'internal' }); }
}
