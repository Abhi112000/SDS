import dbConnect from '@/lib/mongodb';
import Invoice from '@/models/Invoice';
import InvoiceSetting from '@/models/InvoiceSetting';
import { getSession } from 'next-auth/react';
import { getToken } from 'next-auth/jwt';

function escapeHtml(value){
  return String(value || '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char] || char));
}

function fmtMoney(value){
  return '₹' + (Number(value) || 0).toFixed(2);
}

export default async function handler(req, res){
  if(req.method !== 'GET'){
    res.setHeader('Allow', 'GET');
    return res.status(405).end('Method Not Allowed');
  }

  await dbConnect();
  const allowPublic = req.query.public === '1';
  let session = null;
  if(!allowPublic){
    session = await getSession({ req });
    if(!session){
      try{
        const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
        if(token && token.role === 'admin'){
          session = { user: { id: token.sub || token?.sub, role: token.role } };
        }
      }catch(e){
        console.warn('invoice print auth fallback failed', e?.message || e);
      }
    }
    if(!session || session.user?.role !== 'admin'){
      return res.status(403).json({ error: 'admin required' });
    }
  }

  const { id } = req.query;
  if(!id) return res.status(400).json({ error: 'Missing invoice id' });

  let invoice = null;
  try{ invoice = await Invoice.findById(id).lean(); }catch(e){ invoice = null; }
  if(!invoice){
    invoice = await Invoice.findOne({ invoiceId: id }).lean();
  }
  if(!invoice) return res.status(404).json({ error: 'Invoice not found' });

  const settings = await InvoiceSetting.findOne().lean().catch(() => null) || {
    brandName: 'Shree Durga Stationary',
    address: 'Shop No. 12, Market Road, City Name, State - ZIP',
    phone: '9818630972, 8077148123',
    email: 'contact.sdstationary@gmail.com',
    logoPath: '/images/logo.jpeg',
    watermarkText: 'SD Stationary invoice'
  };

  const payload = invoice.payload || {};
  const items = Array.isArray(payload.items) ? payload.items : [];
  const couponCode = payload.coupon?.code || invoice.payload?.coupon?.code || '';
  const createdAt = invoice.createdAt ? new Date(invoice.createdAt).toLocaleString() : '';
  const invoiceId = invoice.invoiceId || invoice._id;
  const subtotal = fmtMoney(invoice.subtotal || payload.subtotal || 0);
  const discount = fmtMoney(invoice.discount || payload.discount || 0);
  const shipping = fmtMoney(invoice.shipping || payload.shipping || 0);
  const tax = fmtMoney(invoice.tax || payload.tax || 0);
  const total = fmtMoney(invoice.total || payload.total || 0);

  const itemRows = items.map(item => {
    const title = escapeHtml(item.title || item.name || 'Item');
    const qty = Number(item.qty || 1);
    const price = fmtMoney(item.price || 0);
    const lineTotal = fmtMoney((Number(item.price) || 0) * qty);
    return `<tr><td style="padding:8px;border:1px solid #ddd">${title}</td><td style="padding:8px;border:1px solid #ddd;text-align:center">${qty}</td><td style="padding:8px;border:1px solid #ddd;text-align:right">${price}</td><td style="padding:8px;border:1px solid #ddd;text-align:right">${lineTotal}</td></tr>`;
  }).join('');

  const customerHtml = `<div>${escapeHtml(payload.name || '')}</div><div>${escapeHtml(payload.email || '')}</div><div>${escapeHtml(payload.phone || '')}</div><div>${escapeHtml(payload.address || '')}</div>`;
  const watermark = escapeHtml(settings.watermarkText || 'SD Stationary invoice');

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${escapeHtml(invoiceId)}</title><style>body{font-family:Arial,Helvetica,sans-serif;color:#222;margin:0;padding:20px}h1{margin:0;font-size:24px}table{width:100%;border-collapse:collapse;margin-top:16px}td,th{border:1px solid #ddd;padding:10px}th{background:#f8f8f8;text-align:left} .watermark{position:fixed;top:45%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:70px;color:rgba(0,0,0,0.05);pointer-events:none;white-space:nowrap} .header-flex{display:flex;justify-content:space-between;align-items:flex-start;gap:16px} .logo{max-width:220px;max-height:100px;object-fit:contain;border-radius:6px} .summary-table{width:320px;margin-top:20px;border-collapse:collapse} .summary-table td{border:none;padding:6px}</style></head><body><div class="watermark">${watermark}</div><div class="header-flex"><div><h1>Invoice</h1><div>Invoice ID: ${escapeHtml(invoiceId)}</div><div>Created: ${escapeHtml(createdAt)}</div></div><div style="text-align:right"><div style="font-size:18px;font-weight:700">${escapeHtml(settings.brandName || 'Shree Durga Stationary')}</div><div>${escapeHtml(settings.address || '')}</div><div>${escapeHtml(settings.phone || '')}</div><div>${escapeHtml(settings.email || '')}</div></div></div><hr/><div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:16px"><div style="min-width:220px"><h3 style="margin-bottom:8px">Billed To</h3>${customerHtml}</div><div style="min-width:220px"><h3 style="margin-bottom:8px">Invoice Details</h3><div>Type: ${escapeHtml(invoice.type || 'custom')}</div><div>Order ID: ${escapeHtml(invoice.orderId || '')}</div><div>Status: ${escapeHtml(invoice.status || '')}</div></div></div><h3 style="margin-top:24px">Items</h3><table><thead><tr><th>Product</th><th style="text-align:center">Qty</th><th style="text-align:right">Unit Price</th><th style="text-align:right">Total</th></tr></thead><tbody>${itemRows}</tbody></table><table class="summary-table" style="margin-left:auto"><tr><td>Subtotal</td><td style="text-align:right">${subtotal}</td></tr><tr><td>Discount${couponCode ? ` (${escapeHtml(couponCode)})` : ''}</td><td style="text-align:right">${discount}</td></tr><tr><td>Shipping</td><td style="text-align:right">${shipping}</td></tr><tr><td>Tax</td><td style="text-align:right">${tax}</td></tr><tr style="font-weight:700;border-top:1px solid #ccc"><td>Total</td><td style="text-align:right">${total}</td></tr></table></body></html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(html);
}
