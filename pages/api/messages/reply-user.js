import dbConnect from '@/lib/mongodb';
import Message from '../../../models/Message';
import pusher from '../../../lib/pusher';
import { getSession } from 'next-auth/react';

export default async function handler(req,res){
  await dbConnect();
  if(req.method !== 'POST') return res.status(405).end();
  const session = await getSession({ req });
  const { id, text } = req.body;
  if(!id || !text) return res.status(400).json({ error: 'id and text required' });
  const msg = await Message.findByIdAndUpdate(id, { $push: { replies: { from: session?.user?.name || session?.user?.email || 'user', text, createdAt: new Date() } }, $set: { read: true } }, { new: true }).lean();
  try{
    // notify admin channel (existing behavior)
    await pusher.trigger('admin-channel', 'message-replied', { messageId: msg._id, text, from: session?.user?.email || 'user' });
  }catch(e){ console.warn('pusher notify admin failed', e?.message || e); }

  try{
    // also notify the specific user channel so the user receives the reply in real-time
    if(msg && msg.fromUserId){
      await pusher.trigger(`user-${msg.fromUserId}`, 'message-reply', { messageId: msg._id, text, from: session?.user?.email || 'admin' });
    }
  }catch(e){ console.warn('pusher notify user failed', e?.message || e); }
  return res.status(200).json({ ok: true, msg });
}
