import dbConnect from '@/lib/mongodb';
import GuestOrder from '@/models/GuestOrder';
import { getSession } from 'next-auth/react';

export default async function handler(req,res){
  await dbConnect();
  const session = await getSession({ req });
  if(!session || session.user.role !== 'admin') return res.status(403).json({ error: 'admin required' });
  const list = await GuestOrder.find({}).sort({ createdAt: -1 }).limit(200).lean();
  return res.status(200).json(list);
}
