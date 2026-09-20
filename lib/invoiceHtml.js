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
    const brandAddress = escapeHtml(settings.address || 'New Friends Colony, Sanjay Nagar, Sector 23, Ghaziabad, Uttar Pradesh');
    const brandPhone = escapeHtml(settings.phone || '9818630972');
    const brandEmail = escapeHtml(settings.email || 'contact.sdstationary@gmail.com');
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

    return `<!doctype html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Invoice ${invoiceId}</title>
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
      </style>
    </head>
    <body>
      <div class="watermark">${watermark}</div>
      <div class="container invoice-compact">
        <div class="invoice-header">
          <div class="brand-block">
            <img src="/images/logo.jpeg" class="logo" alt="logo" />
            <div class="shop-meta">
              <div class="brand">${brandName}</div>
              <div class="muted">${brandAddress}</div>
              <div class="muted">Phone: ${brandPhone} | Email: ${brandEmail}</div>
            </div>
          </div>
          <div class="invoice-meta">
            <div class="invoice-title">Invoice</div>
            <div class="invoice-meta-line">Invoice ID: ${invoiceId}</div>
            <div class="invoice-meta-line">Date: ${escapeHtml(createdAt)}</div>
          </div>
        </div>

        <hr class="divider" />

        <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:16px">
          <div style="min-width:220px">
            <h3 style="margin-bottom:8px">Billed To</h3>
            <div>${customerName}</div>
            <div class="muted">${customerEmail}</div>
            <div class="muted">${customerPhone}</div>
            <div class="muted">${customerAddress}</div>
          </div>
          <div style="min-width:220px">
            <h3 style="margin-bottom:8px">Invoice Details</h3>
            <div>Type: ${escapeHtml(invoice.type || 'custom')}</div>
            <div>Order ID: ${escapeHtml(invoice.orderId || '')}</div>
            <div>Status: ${status}</div>
          </div>
        </div>

        <h3 style="margin-top:12px">Items</h3>
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th style="width:100px;text-align:center">Qty</th>
              <th style="width:140px;text-align:right">Unit Price</th>
              <th style="width:140px;text-align:right">Total</th>
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
            <tr><td>Paid</td><td style="text-align:right">${paidAmount}</td></tr>
            <tr><td style="border-top:1px solid #ddd;font-weight:700">Balance</td><td style="border-top:1px solid #ddd;text-align:right;font-weight:700">${balance}</td></tr>
            <tr><td style="border-top:1px solid #ddd;font-weight:700">Total</td><td style="border-top:1px solid #ddd;text-align:right;font-weight:700">${total}</td></tr>
          </tbody>
        </table>

        <div class="footer-block">
          <div class="footer-note"><strong>Note:</strong> This is a system generated invoice and does not require a physical signature or stamp to be valid.</div>
          <div class="footer-line">Authorized by: ${brandName}</div>
          <div class="footer-line">For any queries, contact +91-9818630972 or contact.sdstationary@gmail.com</div>
        </div>
      </div>
    </body>
    </html>`;
}
