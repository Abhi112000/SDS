import dbConnect from '@/lib/mongodb';
import Message from '../../../models/Message';

export default async function handler(req,res){
  await dbConnect();
  if(req.method !== 'POST') return res.status(405).end();
  const { id } = req.query;
  await Message.findByIdAndUpdate(id, { read: true });
  res.status(200).json({ ok: true });
}
