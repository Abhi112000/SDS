import dbConnect from '@/lib/mongodb';
import Message from '../../../models/Message';
import pusher from '../../../lib/pusher';
import { getSession } from 'next-auth/react';

export default async function handler(req,res){
  await dbConnect();
  if(req.method === 'GET'){
    const session = await getSession({ req });
    // if ?mine=1 return only messages for the current user (or by email)
    const mine = req.query?.mine === '1' || req.query?.mine === 'true';
    let q = {};
    if(mine){
      if(session?.user?.id || session?.user?.email){
        q = { $or: [ { fromUserId: session.user.id }, { fromEmail: session.user.email } ] };
      } else return res.status(401).json({ error: 'not authenticated' });
    }
    const msgs = await Message.find(q).sort({ createdAt:-1 }).limit(200).lean();
    return res.status(200).json(msgs);
  }
  if(req.method === 'POST'){
    const session = await getSession({ req });
    const { subject, text, orderId, name, email, phone } = req.body;
  const message = await Message.create({ fromUserId: session?.user?.id || null, fromName: session?.user?.name || name, fromEmail: session?.user?.email || email, fromPhone: phone || '', subject, text, orderId });
  try{ await pusher.trigger('admin-channel', 'new-message', { messageId: message._id, subject, fromName: message.fromName }); }catch(e){ console.warn('pusher notify admin failed', e?.message || e); }
    return res.status(201).json({ ok:true, message });
  }
  res.status(405).end();
}
