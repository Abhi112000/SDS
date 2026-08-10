import dbConnect from '@/lib/mongodb';
import Message from '../../../models/Message';
import pusher from '../../../lib/pusher';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';

export default async function handler(req,res){
  await dbConnect();
  if(req.method !== 'POST') return res.status(405).end();
  const session = await getServerSession(req, res, authOptions);
  if(!session || session.user?.role !== 'admin') return res.status(403).json({ error: 'admin required' });
  const { id, text } = req.body;
  if(!id || !text) return res.status(400).json({ error: 'id and text required' });
  const msg = await Message.findByIdAndUpdate(id, { $push: { replies: { from: 'admin', text, createdAt: new Date() } } }, { new: true }).lean();
  if(!msg) return res.status(404).json({ error: 'message not found' });
  if(msg.fromUserId){
    try{ await pusher.trigger(`user-${msg.fromUserId}`, 'message-reply', { messageId: msg._id, text }); }catch(e){ console.warn('pusher reply failed', e?.message || e); }
  }
  return res.status(200).json({ ok: true, msg });
}
