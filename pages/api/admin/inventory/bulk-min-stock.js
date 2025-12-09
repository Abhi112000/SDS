import { getSession } from 'next-auth/react';
import dbConnect from '@/lib/mongodb';
import Inventory from '@/models/Inventory';

export default async function handler(req, res){
  await dbConnect();
  const session = await getSession({ req });
  if(!session || session.user.role !== 'admin') return res.status(401).json({ error: 'Unauthorized' });

  if(req.method !== 'POST'){
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try{
    const { items } = req.body; // [{ id, minStockLevel }, ...]
    if(!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'items required' });
    const ops = items.map(i => ({ updateOne: { filter: { _id: i.id }, update: { $set: { minStockLevel: Number(i.minStockLevel || 0) } } } }));
    const result = await Inventory.bulkWrite(ops);
    return res.json({ ok: true, result });
  }catch(e){ console.error(e); return res.status(500).json({ error: 'internal' }); }
}
