import nodemailer from 'nodemailer';
import dbConnect from '@/lib/mongodb';
import Invoice from '@/models/Invoice';
import InvoiceSetting from '@/models/InvoiceSetting';
import { getSession } from 'next-auth/react';
import { getToken } from 'next-auth/jwt';
import { generateInvoiceHtml } from '@/lib/invoiceHtml';

async function getAdminSession(req){
  let session = await getSession({ req });
  if(!session){
    try{ const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET }); if(token && token.role === 'admin'){ session = { user: { id: token.sub, role: token.role } }; } }catch(e){}
  }
  return session;
}

export default async function handler(req,res){
  if(req.method !== 'POST') return res.status(405).json({ error:'Method not allowed' });
  const session = await getAdminSession(req);
  if(!session || session.user?.role !== 'admin') return res.status(403).json({ error:'admin required' });

  const { invoiceId, orderId, customerEmail } = req.body || {};
  if(!invoiceId && !orderId) return res.status(400).json({ error:'invoiceId or orderId required' });
  if(!customerEmail) return res.status(400).json({ error:'customerEmail required' });

  await dbConnect();
  let invoice = null;
  if(invoiceId){ invoice = await Invoice.findOne({ $or:[{ _id: invoiceId }, { invoiceId }] }).lean(); }
  if(!invoice && orderId){ invoice = await Invoice.findOne({ orderId }).lean(); }
  if(!invoice) return res.status(404).json({ error:'Invoice not found' });

  const settings = await InvoiceSetting.findOne().lean().catch(() => null) || {};
  const html = generateInvoiceHtml(invoice, settings);

  if(!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return res.status(500).json({ error:'SMTP not configured' });
  }

  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER;
  const mailOptions = {
    from: fromAddress,
    to: customerEmail,
    subject: `Invoice ${invoice.invoiceId || invoice._id}`,
    html,
    text: `Invoice ${invoice.invoiceId || invoice._id} attached. Open the HTML email to view the invoice.`
  };

  try{
    const info = await transport.sendMail(mailOptions);
    return res.status(200).json({ ok:true, info });
  }catch(e){
    console.error('invoice email failed', e);
    return res.status(500).json({ error:'Failed to send invoice email', details: e.message });
  }
}
