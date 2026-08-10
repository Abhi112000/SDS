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
      const payload = body.payload || {};
      const deliveryCharge = Number(body.shipping ?? body.deliveryCharge ?? payload.deliveryCharge ?? 0);
      body.shipping = deliveryCharge;
      body.deliveryPincode = body.deliveryPincode || payload.deliveryPincode || '';
      body.deliveryDistanceKm = body.deliveryDistanceKm ?? payload.deliveryDistanceKm ?? null;
      body.deliveryRoughDistanceKm = body.deliveryRoughDistanceKm ?? payload.deliveryRoughDistanceKm ?? null;
      body.deliveryLocationPending = body.deliveryLocationPending ?? payload.deliveryLocationPending ?? false;
      body.deliveryLocationUrl = body.deliveryLocationUrl || payload.locationUrl || '';
      if(payload.deliveryCharge !== undefined || body.total === undefined) body.total = Number(body.subtotal || payload.subtotal || 0) - Number(body.discount || 0) + deliveryCharge + Number(body.tax || 0);
      const createdBy = (session && session.user && (session.user.id || session.user._id)) || (token && (token.sub || token.id || (token.user && (token.user.id || token.user._id)))) || '';
      const doc = await Invoice.create({ ...body, createdBy });
      return res.status(201).json({ invoice: doc });
    }catch(e){ return res.status(500).json({ error: e.message }); }
  }
  if(req.method === 'PUT'){
    try{
      const body = req.body || {};
      const { id, invoiceId } = body;
      if(!id && !invoiceId) return res.status(400).json({ error: 'Missing invoice id' });
      // build update object - allow a safe subset of fields to be updated
      const allowed = ['status','paidAmount','balance','payload','subtotal','discount','shipping','tax','total'];
      const update = {};
      for(const k of allowed){ if(typeof body[k] !== 'undefined') update[k] = body[k]; }
      if(Object.keys(update).length === 0) return res.status(400).json({ error: 'No updatable fields provided' });
      const query = id ? { _id: id } : { invoiceId };
      const updated = await Invoice.findOneAndUpdate(query, { $set: update }, { new: true }).lean();
      if(!updated) return res.status(404).json({ error: 'Invoice not found' });
      return res.status(200).json({ invoice: updated });
    }catch(e){ return res.status(500).json({ error: e.message }); }
  }
  res.setHeader('Allow', 'GET,POST,PUT');
  res.status(405).end('Method Not Allowed');
}
