import { getSession } from 'next-auth/react';
import { getToken } from 'next-auth/jwt';
import dbConnect from '@/lib/mongodb';
import Invoice from '@/models/Invoice';

export default async function handler(req, res){
  // try session first, then fallback to JWT token (useful for some server environments)
  const session = await getSession({ req });
  let token = null;
  if(!session){
    try{ token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET }); }catch(e){ token = null; }
  }
  const isAdmin = (session && session.user && session.user.role === 'admin') || (token && (token.role === 'admin' || (token.user && token.user.role === 'admin')));
  if(!isAdmin) return res.status(401).json({ error: 'Unauthorized' });
  await dbConnect();
  if(req.method === 'GET'){
    try{
      const items = await Invoice.find({}).sort({ createdAt: -1 }).limit(200).lean();
      return res.status(200).json({ invoices: items });
    }catch(e){ return res.status(500).json({ error: e.message }); }
  }
  if(req.method === 'POST'){
    try{
      const body = req.body || {};
      // ensure invoiceId
      if(!body.invoiceId) body.invoiceId = `INV-${Date.now()}`;
      const createdBy = (session && session.user && (session.user.id || session.user._id)) || (token && (token.sub || token.id || (token.user && (token.user.id || token.user._id)))) || '';
      const doc = await Invoice.create({ ...body, createdBy });
      return res.status(201).json({ invoice: doc });
    }catch(e){ return res.status(500).json({ error: e.message }); }
  }
  res.setHeader('Allow', 'GET,POST');
  res.status(405).end('Method Not Allowed');
}
