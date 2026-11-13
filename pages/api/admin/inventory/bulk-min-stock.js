import { getSession } from 'next-auth/react';
import dbConnect from '@/lib/mongodb';
import Product from '@/models/Product';

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
    const invalidItem = items.find(i => !Number.isFinite(Number(i.minStockLevel)) || Number(i.minStockLevel) < 0);
    if(invalidItem) return res.status(400).json({ error: 'minStockLevel must be a non-negative number' });
    const ops = items.map(i => {
      const value = Number(i.minStockLevel);
      return { updateOne: { filter: { _id: i.id }, update: { $set: { minStockLevel: value } } } };
    });
    const result = await Product.bulkWrite(ops);
    return res.json({ ok: true, result });
  }catch(e){ console.error(e); return res.status(500).json({ error: 'internal' }); }
}
