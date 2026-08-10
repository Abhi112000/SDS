import { getSession } from 'next-auth/react';
import dbConnect from '@/lib/mongodb';
import Order from '../../../models/Order';
import { useState } from 'react';
import { useRouter } from 'next/router';
import { useToast } from '@/components/Toast';
import { formatReferenceId } from '@/lib/referenceIds';
import { authRedirect } from '@/lib/authRedirect';

export default function AdminOrderDetail({ initialOrder }){
  const router = useRouter();
  const [order, setOrder] = useState(initialOrder);
  const [orderStatus, setOrderStatus] = useState(initialOrder?.status || 'new');
  const [statusSaving, setStatusSaving] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceRecord, setInvoiceRecord] = useState(null);
  const [invoiceForm, setInvoiceForm] = useState({ status: 'unpaid', paidAmount: 0, balance: 0 });
  const [printing, setPrinting] = useState(false);
  const [sendingInvoice, setSendingInvoice] = useState(false);
  const statusOptions = ['new', 'processing', 'shipped', 'delivered', 'cancelled'];
  const toast = useToast();

  const formatDateTime = value => {
    try {
      return new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).format(new Date(value));
    } catch (e) {
      return String(value);
    }
  };

  const getCustomerWhatsappNumber = () => String(order.whatsapp || order.phone || '').replace(/\D/g, '');

  const buildOrderWhatsappSummary = (payload, intro) => {
    const lines = [];
    if (intro) {
      lines.push(intro, '');
    }
    lines.push(`Order ID: ${formatReferenceId('order', payload, !!payload.guest)}`);
    lines.push(`Date: ${formatDateTime(payload.createdAt)}`);
    lines.push(`Status: ${payload.status || orderStatus}`);
    if (payload.name) lines.push(`Customer: ${payload.name}`);
    if (payload.whatsapp || payload.phone) lines.push(`Contact: ${payload.whatsapp || payload.phone}`);
    if (payload.address) lines.push(`Address: ${payload.address}`);
    if (payload.locationUrl) lines.push(`Location URL: ${payload.locationUrl}`);
    lines.push('', 'Items:');
    (payload.items || []).forEach(item => {
      lines.push(`• ${item.title} x ${item.qty || 1} @ ₹${item.price || 0} = ₹${((Number(item.qty) || 1) * (Number(item.price) || 0)).toFixed(2)}`);
    });
    const subtotal = Number(payload.subtotal || 0);
    const deliveryCharge = Number(payload.deliveryCharge || 0);
    const discount = Number(payload.coupon?.discountAmount || 0);
    const totalValue = Number(payload.total ?? (subtotal + deliveryCharge - discount));
    lines.push('', `Subtotal: ₹${subtotal.toFixed(2)}`);
    lines.push(`Delivery: ₹${deliveryCharge.toFixed(2)}`);
    lines.push(`Discount: ₹${discount.toFixed(2)}`);
    lines.push(`Total: ₹${totalValue.toFixed(2)}`);
    return lines.join('\n');
  };

  const openCustomerWhatsApp = (text) => {
    const phone = getCustomerWhatsappNumber();
    if (!phone) {
      toast?.push?.({ message: 'Customer WhatsApp number is not available.', type: 'error' });
      return;
    }
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const getInvoicePrintUrl = invoiceId => `${window.location.origin}/api/admin/invoices/print?id=${encodeURIComponent(invoiceId)}&public=1`;

  return (
    <div className="p-6">
          <button onClick={()=>router.back()} className="mb-4 px-3 py-1 border rounded">Back</button>
      <h1 className="text-2xl font-bold mb-4">Order {formatReferenceId('order', order, !!order.guest)}</h1>
      <div className="bg-white p-4 rounded shadow mb-4">
        <div><strong>Customer:</strong> {order.customerName || order.userName || order.customerEmail || order.name}</div>
        <div><strong>Phone:</strong> {order.whatsapp || order.phone || ''}</div>
        <div><strong>Address:</strong> {order.address || ''}</div>
        <div><strong>Delivery charge:</strong> {order.deliveryCharge != null ? `₹${Number(order.deliveryCharge).toFixed(2)}` : '₹0.00'}</div>
        <div><strong>Discount:</strong> - {order.coupon?.discountAmount != null ? `₹${Number(order.coupon.discountAmount).toFixed(2)}` : '₹0.00'}</div>
        <div><strong>Total:</strong> {order.total != null ? `₹${Number(order.total).toFixed(2)}` : `₹${Number((order.subtotal || 0) + (order.deliveryCharge || 0) - (order.coupon?.discountAmount || 0)).toFixed(2)}`}</div>
          <ul className="list-disc ml-6 mt-2">
            {(order.items||[]).map(i=> <li key={i._id || i.sku}>{i.title} × {i.qty} — ₹{i.price}</li>)}
          </ul>
        </div>
      
      <div className="flex items-center gap-3 mt-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Order status</label>
          <select value={orderStatus} onChange={e => setOrderStatus(e.target.value)} className="p-2 border rounded">
            {statusOptions.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
          <button onClick={async ()=>{
            if(orderStatus === order.status) return;
            setStatusSaving(true);
            try{
              const res = await fetch(`/api/orders/${order._id}`, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: orderStatus }) });
              const data = await res.json();
              if(!res.ok){
                console.error('order status update failed', data);
                toast?.push?.({ message: 'Failed to update order status: ' + (data?.error || data?.message || res.status), type: 'error' });
              } else {
                setOrder(data.order);
                toast?.push?.({ message: 'Order status updated', type: 'success' });
                const text = buildOrderWhatsappSummary(data.order, `Hello ${data.order.name || data.order.customerName || 'Customer'},\nYour order status has been updated to ${data.order.status}.\n\nOrder details:`);
                openCustomerWhatsApp(text);
              }
            }catch(e){
              console.error('status update error', e);
              toast?.push?.({ message: 'Unable to update order status', type: 'error' });
            }
            setStatusSaving(false);
          }} disabled={statusSaving || orderStatus === order.status} className="px-3 py-1 bg-green-600 text-white rounded disabled:opacity-60">{statusSaving ? 'Saving...' : 'Save status'}</button>
        </div>
        <button onClick={async ()=>{
          // download / print invoice for this order. Ensure invoice exists or create a temporary one.
          setPrinting(true);
          try{
            // fetch existing invoices & invoice settings in parallel
            const [invRes, settingsRes] = await Promise.all([
              fetch('/api/admin/invoices', { credentials: 'include' }),
              fetch('/api/admin/invoice-settings', { credentials: 'include' })
            ]);
            const invBody = await invRes.json().catch(()=>({}));
            const settingsBody = await settingsRes.json().catch(()=>({}));
            const existing = (invBody.invoices || []).find(i => i.orderId === order._id) || invoiceRecord;
            let invToUse = existing;
            if(!invToUse){
              // create invoice on-the-fly
              const couponDisc = (order.coupon && order.coupon.discountAmount) || 0;
              const total = (order.subtotal || 0) - couponDisc;
              const invoiceId = `INV-${Date.now()}`;
              const createRes = await fetch('/api/admin/invoices', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ invoiceId, type: 'order', orderId: order._id, payload: order, subtotal: order.subtotal || 0, discount: couponDisc, total }) });
              const created = await createRes.json().catch(()=>null);
              invToUse = created && created.invoice ? created.invoice : null;
            }

            if(!invToUse){ throw new Error('Unable to build invoice'); }
            const invSettings = settingsBody || {};
            const itemsHtml = (order.items || []).map(it => `<tr><td style="padding:8px;border:1px solid #ddd">${(it.title||'Item')}</td><td style="padding:8px;border:1px solid #ddd;text-align:center">${it.qty||1}</td><td style="padding:8px;border:1px solid #ddd;text-align:right">₹${(Number(it.price)||0).toFixed(2)}</td><td style="padding:8px;border:1px solid #ddd;text-align:right">₹${((Number(it.price)||0)*(Number(it.qty)||1)).toFixed(2)}</td></tr>`).join('');
            const subtotal = Number(order.subtotal || 0).toFixed(2);
            const discountVal = Number(order.coupon?.discountAmount || 0).toFixed(2);
            const shipping = Number(order.shipping || 0).toFixed(2);
            const tax = Number(order.tax || 0).toFixed(2);
            const total = Number(order.total || ((order.subtotal||0) - (order.coupon?.discountAmount||0))).toFixed(2);
            const status = invToUse?.status || invoiceForm.status || 'unpaid';
            const paidAmount = Number(invToUse?.paidAmount ?? invoiceForm.paidAmount ?? 0).toFixed(2);
            const balance = Number(invToUse?.balance ?? invoiceForm.balance ?? (Number(total) - Number(paidAmount))).toFixed(2);
            const stampColor = status === 'paid' ? '#16a34a' : (status === 'partially-paid' ? '#f59e0b' : '#ef4444');
            const stampHtml = `<div style="position:absolute;right:36px;top:40px;padding:8px 14px;border-radius:6px;background:${stampColor};color:#fff;font-weight:700;transform:rotate(-6deg);box-shadow:0 2px 6px rgba(0,0,0,0.12)">${status.toUpperCase()}</div>`;

            const invHtml = `<!doctype html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Invoice ${invToUse?.invoiceId || order._id}</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;color:#222;margin:0;padding:24px;background:#fff}
        .container{max-width:900px;margin:0 auto;padding:24px;border:1px solid #f0f0f0}
        .header{display:flex;justify-content:space-between;align-items:center}
        .brand{font-size:20px;font-weight:700}
        .muted{color:#666;font-size:12px}
        table{width:100%;border-collapse:collapse;margin-top:12px}
        th,td{padding:10px;border:1px solid #eee}
        th{background:#fafafa;text-align:left}
        .right{text-align:right}
        .summary{width:360px;margin-left:auto}
        .logo{max-height:80px;max-width:220px;object-fit:contain;border-radius:4px}
        .watermark{position:fixed;top:40%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:80px;color:rgba(0,0,0,0.04);pointer-events:none;user-select:none}
        .note{font-size:12px;color:#444;margin-top:18px}
        .footer{margin-top:28px;font-size:12px;color:#666}
      </style>
    </head>
    <body>
  <div class="watermark">${invSettings?.watermarkText || 'SD Stationary invoice'}</div>
      <div class="container">
        <div class="header">
          <div style="display:flex;align-items:center;gap:12px">
            <img src="/images/logo.jpeg" class="logo" alt="logo" />
            <div>
              <div class="brand">${invSettings?.brandName || 'Shree Durga Stationary'}</div>
              <div class="muted">${invSettings?.address || ''}</div>
              <div class="muted">Phone: ${invSettings?.phone || ''} | Email: ${invSettings?.email || ''}</div>
            </div>
          </div>
          <div style="text-align:right;position:relative;min-width:220px">
            ${stampHtml}
            <div style="font-size:14px;font-weight:700">Invoice</div>
            <div class="muted">Invoice ID: ${invToUse?.invoiceId || order._id}</div>
            <div class="muted">Date: ${new Date(order.createdAt).toLocaleString()}</div>
          </div>
        </div>

        <hr style="border:none;border-top:1px solid #eee;margin:16px 0" />

        <div>
          <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start">
            <div>
              <strong>Bill To</strong>
              <div>${order.name || ''}</div>
              <div class="muted">${order.email || ''}</div>
              <div class="muted">${order.phone || ''}</div>
              <div class="muted">${order.address || ''}</div>
            </div>
          </div>
        </div>

        <h3 style="margin-top:18px">Items</h3>
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th style="width:90px;text-align:center">Qty</th>
              <th style="width:140px;text-align:right">Unit</th>
              <th style="width:160px;text-align:right">Line Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div class="summary">
          <table style="border:none;margin-top:12px">
            <tbody>
              <tr><td class="muted" style="border:none;padding:6px">Subtotal</td><td class="right" style="border:none;padding:6px">₹${subtotal}</td></tr>
              <tr><td class="muted" style="border:none;padding:6px">Discount</td><td class="right" style="border:none;padding:6px">- ₹${discountVal}</td></tr>
              <tr><td class="muted" style="border:none;padding:6px">Shipping</td><td class="right" style="border:none;padding:6px">₹${shipping}</td></tr>
              <tr><td class="muted" style="border:none;padding:6px">Tax</td><td class="right" style="border:none;padding:6px">₹${tax}</td></tr>
              <tr><td class="muted" style="border:none;padding:6px">Paid</td><td class="right" style="border:none;padding:6px">₹${paidAmount}</td></tr>
              <tr><td style="border-top:1px solid #ddd;padding:8px;font-weight:700">Balance</td><td style="border-top:1px solid #ddd;padding:8px;text-align:right;font-weight:700">₹${balance}</td></tr>
              <tr><td style="border-top:1px solid #ddd;padding:8px;font-weight:700">Payable</td><td style="border-top:1px solid #ddd;padding:8px;text-align:right;font-weight:700">₹${total}</td></tr>
            </tbody>
          </table>
        </div>

        <div class="note">
          <strong>Note:</strong> This is a system generated invoice and does not require a physical signature or stamp to be valid.
        </div>

        <div class="footer">
          <div>Authorized by: ${invSettings?.brandName || 'Shree Durga Stationary'}</div>
          <div style="margin-top:6px;color:#999;font-size:12px">For any queries, contact ${invSettings?.phone || ''} or ${invSettings?.email || ''}</div>
        </div>
      </div>
    </body>
    </html>`;

            const w = window.open('about:blank','invoice');
            if(!w){ toast?.push?.({ message: 'Popup blocked. Allow popups to download invoice.', type: 'error' }); setPrinting(false); return; }
            w.document.write(invHtml);
            w.document.close();
            setTimeout(()=>{ try{ w.focus(); w.print(); }catch(e){} setPrinting(false); },350);
          }catch(e){ console.error('print invoice failed', e); toast?.push?.({ message: 'Unable to print invoice', type: 'error' }); setPrinting(false); }
        }} className="px-3 py-1 bg-blue-600 text-white rounded">{printing ? 'Printing…' : 'Download Invoice (PDF)'}</button>
        <button onClick={async ()=>{
          setSendingInvoice(true);
          try{
            const invRes = await fetch('/api/admin/invoices', { credentials: 'include' });
            const invBody = await invRes.json().catch(()=>({}));
            const existing = (invBody.invoices || []).find(i => i.orderId === order._id) || invoiceRecord;
            let invToUse = existing;
            if(!invToUse){
              const couponDisc = (order.coupon && order.coupon.discountAmount) || 0;
              const total = (order.subtotal || 0) - couponDisc;
              const invoiceId = `INV-${Date.now()}`;
              const createRes = await fetch('/api/admin/invoices', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ invoiceId, type: 'order', orderId: order._id, payload: order, subtotal: order.subtotal || 0, discount: couponDisc, total }) });
              const created = await createRes.json().catch(()=>null);
              invToUse = created && created.invoice ? created.invoice : null;
            }
            if(!invToUse) throw new Error('Unable to build invoice');
            const invoiceId = invToUse.invoiceId || invToUse._id;
            const invoiceLink = getInvoicePrintUrl(invoiceId);
            const text = buildOrderWhatsappSummary(order, `Hello ${order.name || 'Customer'},\nYour invoice for order ${order._id} is ready.\n\nInvoice PDF: ${invoiceLink}\n\nOrder details:`);
            openCustomerWhatsApp(text);
            toast?.push?.({ message: 'Invoice message opened in WhatsApp', type: 'success' });
          }catch(e){
            console.error('send invoice error', e);
            toast?.push?.({ message: 'Unable to send invoice: ' + (e.message || 'unknown'), type: 'error' });
          }
          setSendingInvoice(false);
        }} disabled={sendingInvoice} className="px-3 py-1 bg-indigo-600 text-white rounded disabled:opacity-60 ml-2">{sendingInvoice ? 'Sending…' : 'Send invoice on WhatsApp'}</button>
      </div>

      {showInvoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white p-6 rounded shadow max-w-md w-full">
            <h3 className="text-lg font-semibold mb-3">Update invoice status</h3>
            {invoiceLoading ? <div>Loading…</div> : (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm">Status</label>
                  <select value={invoiceForm.status} onChange={(e)=>setInvoiceForm(s=>({...s, status: e.target.value}))} className="mt-1 w-full border p-2 rounded">
                    <option value="unpaid">Unpaid</option>
                    <option value="partially-paid">Partially paid</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm">Paid amount</label>
                  <input type="number" value={invoiceForm.paidAmount} onChange={(e)=>{
                    const paid = parseFloat(e.target.value) || 0; const total = ((order.subtotal||0) - ((order.coupon && order.coupon.discountAmount)||0));
                    setInvoiceForm(s=>({ ...s, paidAmount: paid, balance: Math.max(0, total - paid) }));
                  }} className="mt-1 w-full border p-2 rounded" />
                </div>
                <div>
                  <label className="block text-sm">Balance</label>
                  <input type="number" value={invoiceForm.balance} onChange={(e)=>setInvoiceForm(s=>({...s, balance: parseFloat(e.target.value) || 0}))} className="mt-1 w-full border p-2 rounded" />
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <button onClick={()=>setShowInvoiceModal(false)} className="px-3 py-1 border rounded">Cancel</button>
                  <button onClick={async ()=>{
                    // submit update or create with validation
                    try{
                      const couponDisc = (order.coupon && order.coupon.discountAmount) || 0;
                      const total = Number((invoiceRecord && invoiceRecord.total) || ((order.subtotal || 0) - couponDisc) || 0);
                      const paid = Number(invoiceForm.paidAmount || 0);
                      if(paid < 0){ toast?.push?.({ message: 'Paid amount cannot be negative', type: 'error' }); return; }
                      if(paid > total){ toast?.push?.({ message: 'Paid amount cannot exceed total payable', type: 'error' }); return; }

                      let statusToSave = invoiceForm.status;
                      if(paid >= total) statusToSave = 'paid';
                      else if(paid > 0 && paid < total) statusToSave = 'partially-paid';

                      const payload = { status: statusToSave, paidAmount: paid, balance: Number(invoiceForm.balance || Math.max(0, total - paid)) };
                      let res, data;
                      if(invoiceRecord && invoiceRecord._id){
                        res = await fetch('/api/admin/invoices', { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: invoiceRecord._id, ...payload }) });
                        data = await res.json();
                      } else {
                        const invoiceId = `INV-${Date.now()}`;
                        res = await fetch('/api/admin/invoices', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ invoiceId, type: 'order', orderId: order._id, payload: order, subtotal: order.subtotal || 0, discount: couponDisc, total, ...payload }) });
                        data = await res.json();
                      }
                      if(res && res.ok){
                        setShowInvoiceModal(false);
                        setInvoiceRecord(data.invoice || data.invoice);
                        toast?.push?.({ message: 'Invoice saved', type: 'success' });
                      } else {
                        console.error('invoice update failed', data);
                        toast?.push?.({ message: 'Failed to save invoice: '+ (data && data.error), type: 'error' });
                      }
                    }catch(e){ console.error(e); toast?.push?.({ message: 'Error saving invoice', type: 'error' }); }
                  }} className="px-3 py-1 bg-blue-600 text-white rounded">Save</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mt-6">
        <div className="bg-white p-4 rounded shadow">
          <p className="text-sm text-gray-600">Customer communication is handled via WhatsApp. Use the status update and invoice buttons to notify the customer with a complete order summary.</p>
        </div>
      </div>
    </div>
  );
}

export async function getServerSideProps(ctx){
  const session = await getSession(ctx);
  if(!session || session.user?.role !== 'admin') return authRedirect(ctx);
  const { id } = ctx.params;
  await dbConnect();
  const order = await Order.findById(id).lean();
  return { props: { initialOrder: JSON.parse(JSON.stringify(order || {})) } };
}