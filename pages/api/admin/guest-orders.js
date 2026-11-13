import dbConnect from '@/lib/mongodb';
import GuestOrder from '@/models/GuestOrder';
import { getSession } from 'next-auth/react';

export default async function handler(req,res){
  await dbConnect();
  const session = await getSession({ req });
  if(!session || session.user.role !== 'admin') return res.status(403).json({ error: 'admin required' });
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const [orders, total] = await Promise.all([
    GuestOrder.find({}).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    GuestOrder.countDocuments({})
  ]);
  return res.status(200).json({ orders, total, page, limit });
}
