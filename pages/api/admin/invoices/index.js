import { getSession } from 'next-auth/react';
import { getToken } from 'next-auth/jwt';
import dbConnect from '@/lib/mongodb';
import Invoice from '@/models/Invoice';
import Order from '@/models/Order';
import User from '@/models/User';

function formatInvoiceDateTimeStamp(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const values = {};
  parts.forEach(part => {
    if (part.type !== 'literal') values[part.type] = part.value;
  });
  return `${values.year || '0000'}${values.month || '00'}${values.day || '00'}${values.hour || '00'}${values.minute || '00'}${values.second || '00'}`;
}

export default async function handler(req, res){
  // try session first, then fallback to JWT token (useful for some server environments)
  const session = await getSession({ req });
  let token = null;
  if(!session){
    try{ token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET }); }catch(e){ token = null; }
  }
  const isAdmin = (session && session.user && session.user.role === 'admin') || (token && (token.role === 'admin' || (token.user && token.user.role === 'admin')));
  await dbConnect();
  if(req.method === 'GET'){
    if(!isAdmin) return res.status(401).json({ error: 'Unauthorized' });
    try{
      const items = await Invoice.find({}).sort({ createdAt: -1 }).limit(200).lean();
      return res.status(200).json({ invoices: items });
    }catch(e){ return res.status(500).json({ error: e.message }); }
  }
  if(req.method === 'POST'){
    try{
      if(!session && !token) return res.status(401).json({ error: 'Unauthorized' });
      const body = req.body || {};
      const authenticatedUserEmail = session?.user?.email || token?.email || token?.user?.email || '';
      const isSelfGeneratedOrder = !isAdmin && !!body.orderId && authenticatedUserEmail;
      if(!isAdmin && !isSelfGeneratedOrder) return res.status(403).json({ error: 'Unauthorized' });
      if(!isAdmin && isSelfGeneratedOrder){
        const currentUser = await User.findOne({ email: authenticatedUserEmail }).lean();
        const order = await Order.findById(body.orderId).lean();
        if(!order) return res.status(404).json({ error: 'Order not found' });
        const userMatches = String(order.userId || '') === String(currentUser?._id || '') || String(order.email || '').toLowerCase() === String(authenticatedUserEmail).toLowerCase();
        if(!userMatches) return res.status(403).json({ error: 'Not allowed to generate this invoice' });
        const normalizedStatus = String(order.status || '').toLowerCase();
        if(!['delivered', 'completed'].includes(normalizedStatus)) return res.status(400).json({ error: 'Order must be delivered or completed before creating an invoice' });
      }
      // ensure invoiceId with date-time stamp in the suffix for traceability
      if(!body.invoiceId){
        body.invoiceId = `INV-${formatInvoiceDateTimeStamp()}`;
      }
      const payload = body.payload || {};
      const deliveryCharge = Number(body.shipping ?? body.deliveryCharge ?? payload.deliveryCharge ?? 0);
      body.shipping = deliveryCharge;
      body.deliveryLocationPending = body.deliveryLocationPending ?? payload.deliveryLocationPending ?? false;
      body.deliveryLocationUrl = body.deliveryLocationUrl || payload.locationUrl || '';
      if(payload.deliveryCharge !== undefined || body.total === undefined) body.total = Number(body.subtotal || payload.subtotal || 0) - Number(body.discount || 0) + deliveryCharge + Number(body.tax || 0);
      const createdBy = (session && session.user && (session.user.id || session.user._id)) || (token && (token.sub || token.id || (token.user && (token.user.id || token.user._id)))) || '';
      const doc = await Invoice.create({ ...body, createdBy });
      return res.status(201).json({ invoice: doc });
    }catch(e){ return res.status(500).json({ error: e.message }); }
  }
  if(req.method === 'DELETE'){
    try{
      if(!isAdmin) return res.status(401).json({ error: 'Unauthorized' });
      const body = req.body || {};
      const { id, invoiceId } = body;
      if(!id && !invoiceId) return res.status(400).json({ error: 'Missing invoice id' });
      const query = id ? { _id: id } : { invoiceId };
      const deleted = await Invoice.findOneAndDelete(query).lean();
      if(!deleted) return res.status(404).json({ error: 'Invoice not found' });
      return res.status(200).json({ ok: true, deleted });
    }catch(e){ return res.status(500).json({ error: e.message }); }
  }
  if(req.method === 'PUT'){
    try{
      if(!isAdmin) return res.status(401).json({ error: 'Unauthorized' });
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
  res.setHeader('Allow', 'GET,POST,PUT,DELETE');
  res.status(405).end('Method Not Allowed');
}
