import dbConnect from '@/lib/mongodb';
import Message from '../../../models/Message';
import pusher from '../../../lib/pusher';
import { getSession } from 'next-auth/react';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getToken } from 'next-auth/jwt';

export default async function handler(req,res){
  await dbConnect();
  let session = await getSession({ req });
  // debug: log whether cookie present and basic session info
  try{
    const cookieHeader = req.headers.cookie || '[no cookie header]';
    console.log('[debug] POST /api/messages/reply called - cookie header length:', cookieHeader.length, 'raw:', cookieHeader.substring(0,200));
    console.log('[debug] body:', req.body && Object.keys(req.body).length ? '[has body]' : '[empty body]');
    // try server-side session as a fallback
    let serverSession = null;
    try{ serverSession = await getServerSession(req, res, authOptions); }catch(se){ console.warn('[debug] getServerSession failed', se?.message || se); }
    // try token-based fallback (useful if getSession/getServerSession fail)
    let token = null;
    try{ token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET }); }catch(te){ console.warn('[debug] getToken failed', te?.message || te); }
    console.log('[debug] client getSession user:', session?.user || null, 'server getServerSession user:', serverSession?.user || null, 'token:', token ? { sub: token.sub, email: token.email, role: token.role } : null);
    // prefer serverSession, then token, then client session
    let effectiveSession = serverSession || session || null;
    if(!effectiveSession && token){
      effectiveSession = { user: { id: token.sub || null, email: token.email || null, role: token.role || 'user' } };
    }
    if(!effectiveSession || effectiveSession.user.role !== 'admin') return res.status(403).json({ error: 'admin required' });
    // eslint-disable-next-line no-unused-vars
    session = effectiveSession;
  }catch(e){ console.warn('[debug] logging failed', e); }
  if(req.method !== 'POST') return res.status(405).end();
  const { id, text } = req.body;
  const msg = await Message.findByIdAndUpdate(id, { $push: { replies: { from: 'admin', text, createdAt: new Date() } } }, { new: true }).lean();
  // notify user if they have a user id
  if(msg.fromUserId) {
  try { await pusher.trigger(`user-${msg.fromUserId}`, 'message-reply', { messageId: msg._id, text }); } catch(e){ console.warn('pusher reply failed', e?.message || e); }
  }
  return res.status(200).json({ ok: true, msg });
}
