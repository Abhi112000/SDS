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
    address: 'New Friends Colony, Sanjay Nagar, Sector 23, Ghaziabad, Uttar Pradesh',
    phone: '9818630972',
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
  const shipping = fmtMoney(invoice.shipping ?? payload.deliveryCharge ?? payload.shipping ?? 0);
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

    const html = `<!doctype html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Invoice ${escapeHtml(invoiceId)}</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap" rel="stylesheet">
      <style>
        body{font-family:Inter, Arial,Helvetica,sans-serif;color:#111;margin:0;padding:16px;background:#fff;font-size:13px}
        .container{max-width:800px;margin:0 auto;padding:14px;border:1px solid #f3f3f3}
        .invoice-header{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;padding:4px 2px 10px;page-break-inside:avoid}
        .brand-block{display:flex;align-items:flex-start;gap:12px;flex:1;min-width:0}
        .logo{max-width:72px;max-height:72px;width:72px;height:72px;object-fit:contain;border-radius:6px;flex-shrink:0}
        .shop-meta{min-width:0}
        .brand{font-size:20px;font-weight:700;line-height:1.3;margin:0 0 4px;color:#111}
        .muted{color:#555;font-size:12px;line-height:1.5}
        .invoice-meta{min-width:180px;text-align:right;flex-shrink:0}
        .invoice-title{font-size:16px;font-weight:700;line-height:1.2;margin:0 0 6px;color:#111}
        .invoice-meta-line{color:#555;font-size:12px;line-height:1.6}
        .divider{border:none;border-top:1px solid #e5e7eb;margin:0 0 12px}
        table{width:100%;border-collapse:collapse;margin-top:10px}
        th,td{padding:8px;border:1px solid #eee;font-size:13px}
        th{background:#fafafa;text-align:left}
        .watermark{position:fixed;top:48%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:48px;color:rgba(0,0,0,0.04);pointer-events:none}
        .summary-table{width:320px;margin-top:8px;border-collapse:collapse}
        .summary-table td{border:none;padding:6px}
        .footer-block{margin-top:18px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:12px;color:#444;line-height:1.7}
        .footer-note{margin:0 0 8px}
        .footer-line{margin:0}
        .print-bar{display:flex;justify-content:flex-end;margin-bottom:12px}
        .print-btn{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;background:#2563eb;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:600}
        @media print {.print-bar{display:none !important}.print-btn{display:none !important}}
      </style>
    </head>
    <body>
      <div class="print-bar"><button type="button" class="print-btn" onclick="window.print()">Print</button></div>
      <div class="watermark">${watermark}</div>
      <div class="container invoice-compact">
        <div class="invoice-header">
          <div class="brand-block">
            <img src="${escapeHtml(settings.logoPath || '/images/logo.jpeg')}" class="logo" alt="logo" />
            <div class="shop-meta">
              <div class="brand">${escapeHtml(settings.brandName || 'Shree Durga Stationary')}</div>
              <div class="muted">${escapeHtml(settings.address || 'New Friends Colony, Sanjay Nagar, Sector 23, Ghaziabad, Uttar Pradesh')}</div>
              <div class="muted">Phone: ${escapeHtml(settings.phone || '9818630972')} | Email: ${escapeHtml(settings.email || 'contact.sdstationary@gmail.com')}</div>
            </div>
          </div>
          <div class="invoice-meta">
            <div class="invoice-title">Invoice</div>
            <div class="invoice-meta-line">Invoice ID: ${escapeHtml(invoiceId)}</div>
            <div class="invoice-meta-line">Date: ${escapeHtml(createdAt)}</div>
          </div>
        </div>

        <hr class="divider" />

        <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:16px">
          <div style="min-width:220px">
            <h3 style="margin-bottom:8px">Billed To</h3>
            ${customerHtml}
          </div>
        </div>

        <h3 style="margin-top:12px">Items</h3>
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th style="text-align:center">Qty</th>
              <th style="text-align:right">Unit Price</th>
              <th style="text-align:right">Total</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>

        <table class="summary-table" style="margin-left:auto">
          <tbody>
            <tr><td>Subtotal</td><td style="text-align:right">${subtotal}</td></tr>
            <tr><td>Discount</td><td style="text-align:right">${discount}</td></tr>
            <tr><td>Shipping</td><td style="text-align:right">${shipping}</td></tr>
            <tr><td>Tax</td><td style="text-align:right">${tax}</td></tr>
            <tr><td>Paid</td><td style="text-align:right">${total}</td></tr>
            <tr><td style="border-top:1px solid #ddd;font-weight:700">Total</td><td style="border-top:1px solid #ddd;text-align:right;font-weight:700">${total}</td></tr>
          </tbody>
        </table>

        <div class="footer-block">
          <div class="footer-note"><strong>Note:</strong> This is a system generated invoice and does not require a physical signature or stamp to be valid.</div>
          <div class="footer-line">Authorized by: ${escapeHtml(settings.brandName || 'Shree Durga Stationary')}</div>
          <div class="footer-line">For any queries, contact +91-9818630972 or contact.sdstationary@gmail.com</div>
        </div>
      </div>
    </body>
    </html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(html);
}
