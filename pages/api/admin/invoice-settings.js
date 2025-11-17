import dbConnect from '@/lib/mongodb';
import InvoiceSetting from '@/models/InvoiceSetting';
import { getSession } from 'next-auth/react';
import { getToken } from 'next-auth/jwt';

export default async function handler(req, res){
  await dbConnect();
  // auth
  let session = await getSession({ req });
  if(!session){
    try{ const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET }); if(token && token.sub) session = { user: { id: token.sub, role: token.role || 'user' } }; }catch(e){}
  }
  if(!session || session.user.role !== 'admin') return res.status(403).json({ error: 'admin required' });

  if(req.method === 'GET'){
    const s = await InvoiceSetting.findOne().lean();
    return res.status(200).json(s || {});
  }

  if(req.method === 'PUT'){
    const payload = req.body || {};
    const updated = await InvoiceSetting.findOneAndUpdate({}, { ...payload, updatedAt: new Date() }, { upsert: true, new: true });
    return res.status(200).json(updated);
  }

  res.status(405).end();
}
