import dbConnect from '@/lib/mongodb';
import Message from '../../../models/Message';
import pusher from '../../../lib/pusher';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';

export default async function handler(req,res){
  await dbConnect();
  if(req.method !== 'POST') return res.status(405).end();
  const session = await getServerSession(req, res, authOptions);
  const { id, text } = req.body;
  if(!id || !text) return res.status(400).json({ error: 'id and text required' });
  const msg = await Message.findByIdAndUpdate(id, { $push: { replies: { from: session?.user?.name || session?.user?.email || 'user', text, createdAt: new Date() } }, $set: { read: true } }, { new: true }).lean();
  if(!msg) return res.status(404).json({ error: 'Message not found' });
  try{
    await pusher.trigger('admin-channel', 'message-replied', { messageId: msg._id, text, from: session?.user?.email || 'user' });
  }catch(e){ console.warn('pusher notify admin failed', e?.message || e); }

  try{
    const userChannel = msg.fromUserId ? `user-${msg.fromUserId}` : (msg.fromEmail ? `user-${msg.fromEmail}` : null);
    if(userChannel){
      await pusher.trigger(userChannel, 'message-reply', { messageId: msg._id, text, from: session?.user?.email || 'admin' });
    }
  }catch(e){ console.warn('pusher notify user failed', e?.message || e); }
  return res.status(200).json({ ok: true, msg });
}
