import dbConnect from '@/lib/mongodb';
import Message from '../../../models/Message';
import { getSession } from 'next-auth/react';

export default async function handler(req,res){
  await dbConnect();
  if(req.method !== 'POST') return res.status(405).end();
  const session = await getSession({ req });
  if(!session || session.user?.role !== 'admin') return res.status(403).json({ error: 'admin required' });
  const { id } = req.query;
  if(!id) return res.status(400).json({ error: 'id required' });
  await Message.findByIdAndUpdate(id, { read: true });
  res.status(200).json({ ok: true });
}
