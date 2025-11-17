import dbConnect from '@/lib/mongodb';
import User from '../../../models/User';
import { getSession } from 'next-auth/react';

export default async function handler(req,res){
  await dbConnect();
  const session = await getSession({ req });
  if(!session || session.user.role !== 'admin') return res.status(403).json({ error: 'admin required' });
  if(req.method === 'GET'){
    const users = await User.find({}).select('name email role createdAt').lean();
    return res.status(200).json({ ok:true, users });
  }
  if(req.method === 'PUT'){
    const { id, role, disabled } = req.body;
    if(!id) return res.status(400).json({ error: 'id required' });
    const updated = await User.findByIdAndUpdate(id, { $set: { role, disabled } }, { new: true }).lean();
    return res.status(200).json({ ok:true, user: updated });
  }
  if(req.method === 'DELETE'){
    const { id } = req.query;
    if(!id) return res.status(400).json({ error: 'id required' });
    await User.findByIdAndDelete(id);
    return res.status(204).end();
  }
  res.status(405).end();
}
