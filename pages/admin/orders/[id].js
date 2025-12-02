import { getSession } from 'next-auth/react';
import dbConnect from '@/lib/mongodb';
import Order from '../../../models/Order';
import Message from '../../../models/Message';
import { useState, useEffect } from 'react';
// local toast handled via showToast; do not import default Toast (use ToastProvider/useToast elsewhere)
import { useRouter } from 'next/router';

export default function AdminOrderDetail({ initialOrder, initialMessages }){
  const router = useRouter();
  const [order, setOrder] = useState(initialOrder);
  const [messages, setMessages] = useState(initialMessages || []);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceRecord, setInvoiceRecord] = useState(null);
  const [invoiceForm, setInvoiceForm] = useState({ status: 'unpaid', paidAmount: 0, balance: 0 });
  const [printing, setPrinting] = useState(false);
  const [toast, setToast] = useState(null); // { message, type }

  function showToast(message, type = 'success'){
    setToast({ message, type });
    setTimeout(()=> setToast(null), 3500);
  }

  useEffect(()=>{ /* placeholder for any client-side refresh */ },[]);

  return (
    <div className="p-6">
      <button onClick={()=>router.push('/admin')} className="mb-4 px-3 py-1 border rounded">Back</button>
      <h1 className="text-2xl font-bold mb-4">Order {order._id}</h1>
      <div className="bg-white p-4 rounded shadow mb-4">
        <div><strong>Customer:</strong> {order.customerName || order.userName || order.customerEmail}</div>
        <div><strong>Phone:</strong> {order.whatsapp || order.phone || ''}</div>
        <div><strong>Address:</strong> {order.address || ''}</div>
        <div className="mt-2"><strong>Items:</strong>
          <ul className="list-disc ml-6 mt-2">
            {(order.items||[]).map(i=> <li key={i._id || i.sku}>{i.title} × {i.qty} — ₹{i.price}</li>)}
          </ul>
        </div>
      </div>

      <div className="flex items-center gap-3 mt-4">
        <button onClick={async ()=>{
          // open modal and load invoice if exists
          setShowInvoiceModal(true);
          setInvoiceLoading(true);
          try{
            const res = await fetch('/api/admin/invoices', { credentials: 'include' });
            const data = await res.json();
            const inv = (data.invoices||[]).find(i => i.orderId === order._id);
            if(inv){
              setInvoiceRecord(inv);
              setInvoiceForm({ status: inv.status || 'unpaid', paidAmount: inv.paidAmount || 0, balance: inv.balance || (inv.total ? (inv.total - (inv.paidAmount||0)) : 0) });
            }else{
              // default values based on order
              const couponDisc = (order.coupon && order.coupon.discountAmount) || 0;
              const total = (order.subtotal || 0) - couponDisc;
              setInvoiceRecord(null);
              setInvoiceForm({ status: 'unpaid', paidAmount: 0, balance: total });
            }
          }catch(e){ console.error('load invoice failed', e); }
          setInvoiceLoading(false);
        }} className="px-3 py-1 bg-yellow-600 text-white rounded">Update invoice status</button>
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

            // build invoice html (reuse structure from admin/index.js but include status stamp & paid/balance rows)
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
            if(!w){ showToast('Popup blocked. Allow popups to download invoice.', 'error'); setPrinting(false); return; }
            w.document.write(invHtml);
            w.document.close();
            setTimeout(()=>{ try{ w.focus(); w.print(); }catch(e){} setPrinting(false); },350);
          }catch(e){ console.error('print invoice failed', e); showToast('Unable to print invoice', 'error'); setPrinting(false); }
        }} className="px-3 py-1 bg-blue-600 text-white rounded">{printing ? 'Printing…' : 'Download Invoice (PDF)'}</button>
      </div>

      <Toast message={toast?.message} type={toast?.type} />

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
                      if(paid < 0){ showToast('Paid amount cannot be negative', 'error'); return; }
                      if(paid > total){ showToast('Paid amount cannot exceed total payable', 'error'); return; }

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
                        showToast('Invoice saved', 'success');
                      } else {
                        console.error('invoice update failed', data);
                        showToast('Failed to save invoice: '+ (data && data.error), 'error');
                      }
                    }catch(e){ console.error(e); showToast('Error saving invoice', 'error'); }
                  }} className="px-3 py-1 bg-blue-600 text-white rounded">Save</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <h2 className="text-xl font-semibold mb-2">Related messages</h2>
      <div className="space-y-3">
        {messages.map(m=> (
          <div key={m._id} className="card">
            <div className="font-semibold">{m.subject}</div>
            <div className="text-sm text-gray-600">From: {m.fromName} • {new Date(m.createdAt).toLocaleString()}</div>
            <div className="mt-2 text-sm">{m.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export async function getServerSideProps(ctx){
  const session = await getSession(ctx);
  if(!session || session.user.role !== 'admin') return { redirect: { destination: '/login', permanent: false } };
  const { id } = ctx.params;
  await dbConnect();
  const order = await Order.findById(id).lean();
  const messages = await Message.find({ orderId: id }).sort({ createdAt:-1 }).lean();
  return { props: { initialOrder: JSON.parse(JSON.stringify(order || {})), initialMessages: JSON.parse(JSON.stringify(messages || [])) } };
}
