import InvoiceSetting from '@/models/InvoiceSetting';

function escapeHtml(value){
  return String(value || '').replace(/[&<>"]|'/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char] || char));
}

function fmtMoney(value){
  const amount = Number(value || 0);
  return '₹' + amount.toFixed(2);
}

export function generateInvoiceHtml(invoice, settings = {}){
  const payload = invoice.payload || {};
  const items = Array.isArray(payload.items) ? payload.items : [];
  const createdAt = invoice.createdAt ? new Date(invoice.createdAt).toLocaleString() : '';
  const invoiceId = escapeHtml(invoice.invoiceId || invoice._id || '');
  const status = escapeHtml(invoice.status || 'unpaid');
  const customerName = escapeHtml(payload.name || payload.customerName || payload.userName || '');
  const customerEmail = escapeHtml(payload.email || payload.customerEmail || '');
  const customerPhone = escapeHtml(payload.phone || payload.whatsapp || '');
  const customerAddress = escapeHtml(payload.address || '');
  const brandName = escapeHtml(settings.brandName || 'Shree Durga Stationary');
  const brandAddress = escapeHtml(settings.address || '');
  const brandPhone = escapeHtml(settings.phone || '');
  const brandEmail = escapeHtml(settings.email || '');
  const watermark = escapeHtml(settings.watermarkText || 'SD Stationary invoice');

  const itemRows = items.map(item => {
    const title = escapeHtml(item.title || item.name || 'Item');
    const qty = Number(item.qty || 1);
    const price = fmtMoney(item.price || 0);
    const lineTotal = fmtMoney((Number(item.price) || 0) * qty);
    return `<tr><td style="padding:8px;border:1px solid #ddd">${title}</td><td style="padding:8px;border:1px solid #ddd;text-align:center">${qty}</td><td style="padding:8px;border:1px solid #ddd;text-align:right">${price}</td><td style="padding:8px;border:1px solid #ddd;text-align:right">${lineTotal}</td></tr>`;
  }).join('');

  const subtotal = fmtMoney(invoice.subtotal || payload.subtotal || 0);
  const discount = fmtMoney(invoice.discount || payload.discount || 0);
  const shipping = fmtMoney(invoice.shipping || payload.shipping || 0);
  const tax = fmtMoney(invoice.tax || payload.tax || 0);
  const total = fmtMoney(invoice.total || payload.total || 0);
  const paidAmount = fmtMoney(invoice.paidAmount || 0);
  const balance = fmtMoney(invoice.balance || 0);
  const stampColor = status === 'paid' ? '#16a34a' : (status === 'partially-paid' ? '#f59e0b' : '#ef4444');

  return `<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${invoiceId}</title><style>body{font-family:Arial,Helvetica,sans-serif;color:#222;margin:0;padding:20px}h1{margin:0;font-size:24px}table{width:100%;border-collapse:collapse;margin-top:16px}td,th{border:1px solid #ddd;padding:10px}th{background:#f8f8f8;text-align:left} .watermark{position:fixed;top:45%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:70px;color:rgba(0,0,0,0.06);pointer-events:none;white-space:nowrap} .header-flex{display:flex;justify-content:space-between;align-items:flex-start;gap:16px} .summary-table{width:320px;margin-top:20px;border-collapse:collapse} .summary-table td{border:none;padding:6px} .summary-table .label{color:#555}</style></head><body><div class="watermark">${watermark}</div><div class="header-flex"><div><h1>Invoice</h1><div>Invoice ID: ${invoiceId}</div><div>Date: ${escapeHtml(createdAt)}</div></div><div style="text-align:right"><div style="font-size:18px;font-weight:700">${brandName}</div><div>${brandAddress}</div><div>${brandPhone}</div><div>${brandEmail}</div></div></div><hr/><div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:16px"><div style="min-width:220px"><h3 style="margin-bottom:8px">Billed To</h3><div>${customerName}</div><div>${customerEmail}</div><div>${customerPhone}</div><div>${customerAddress}</div></div><div style="min-width:220px"><h3 style="margin-bottom:8px">Invoice Details</h3><div>Type: ${escapeHtml(invoice.type || 'custom')}</div><div>Order ID: ${escapeHtml(invoice.orderId || '')}</div><div>Status: ${status}</div></div></div><h3 style="margin-top:24px">Items</h3><table><thead><tr><th>Product</th><th style="width:100px;text-align:center">Qty</th><th style="width:140px;text-align:right">Unit Price</th><th style="width:140px;text-align:right">Total</th></tr></thead><tbody>${itemRows}</tbody></table><table class="summary-table" style="margin-left:auto"><tbody><tr><td class="label">Subtotal</td><td style="text-align:right">${subtotal}</td></tr><tr><td class="label">Discount</td><td style="text-align:right">${discount}</td></tr><tr><td class="label">Shipping</td><td style="text-align:right">${shipping}</td></tr><tr><td class="label">Tax</td><td style="text-align:right">${tax}</td></tr><tr><td class="label">Paid</td><td style="text-align:right">${paidAmount}</td></tr><tr><td class="label" style="font-weight:700">Balance</td><td style="text-align:right;font-weight:700">${balance}</td></tr><tr><td class="label" style="font-weight:700">Total</td><td style="text-align:right;font-weight:700">${total}</td></tr></tbody></table><div style="margin-top:24px;font-size:12px;color:#555">This is a system generated invoice. No signature is required.</div></body></html>`;
}
