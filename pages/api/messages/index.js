import dbConnect from '@/lib/mongodb';
import Message from '../../../models/Message';
import pusher from '../../../lib/pusher';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getToken } from 'next-auth/jwt';

export default async function handler(req,res){
  await dbConnect();
  if(req.method === 'GET'){
    const mine = req.query?.mine === '1' || req.query?.mine === 'true';
    let q = {};
    const orderId = req.query?.orderId;
    if(mine){
      const session = await getServerSession(req, res, authOptions);
      let token = null;
      try{ token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET }); }catch(e){}
      const userId = session?.user?.id || token?.sub;
      const email = session?.user?.email || token?.email;
      if(!userId && !email) return res.status(401).json({ error: 'not authenticated' });
      q = {
        $or: [
          { fromUserId: userId },
          { fromEmail: email },
          { toUserId: userId },
          { toEmail: email }
        ]
      };
    } else {
      const session = await getServerSession(req, res, authOptions);
      let token = null;
      try{ token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET }); }catch(e){}
      const role = session?.user?.role || token?.role;
      if(!role || role !== 'admin') return res.status(403).json({ error: 'admin required' });
    }
    if(orderId) q.orderId = orderId;
    const msgs = await Message.find(q).sort({ createdAt:-1 }).limit(200).lean();
    return res.status(200).json(msgs);
  }
  if(req.method === 'POST'){
    try {
      const session = await getServerSession(req, res, authOptions).catch(() => null);
      const { subject, text, orderId, name, email, phone, address, targetUserId, targetEmail, type } = req.body || {};
      if (!text || !String(text).trim()) return res.status(400).json({ error: 'Message text is required' });
      const isAdmin = session?.user?.role === 'admin';
      const message = await Message.create({
        fromUserId: isAdmin ? null : session?.user?.id || null,
        fromName: isAdmin ? (session?.user?.name || 'Support') : (session?.user?.name || name || 'Website visitor'),
        fromEmail: isAdmin ? (session?.user?.email || process.env.ADMIN_EMAIL || 'support@example.com') : (session?.user?.email || email || ''),
        toUserId: isAdmin ? targetUserId || null : null,
        toEmail: isAdmin ? targetEmail || null : null,
        fromPhone: phone || '',
        fromAddress: address || '',
        subject: subject || 'Customer message',
        text: String(text).trim(),
        type: ['contact', 'feedback', 'update-request', 'support'].includes(type) ? type : 'support',
        orderId
      });
      try{ await pusher.trigger('admin-channel', 'new-message', { messageId: message._id, subject: message.subject, fromName: message.fromName }); }catch(e){ console.warn('pusher notify admin failed', e?.message || e); }
      if(isAdmin && targetUserId){
        try{ await pusher.trigger(`user-${targetUserId}`, 'new-message', { messageId: message._id, subject: message.subject, text: message.text, orderId }); }catch(e){ console.warn('pusher notify user failed', e?.message || e); }
      }
      return res.status(201).json({ ok:true, message });
    } catch (error) {
      console.error('message create failed:', error?.message || error);
      return res.status(500).json({ error: 'Unable to save message. Please try again.' });
    }
  }
  res.status(405).end();
}
