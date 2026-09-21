import { getSession } from 'next-auth/react';
import dbConnect from '@/lib/mongodb';
import GuestOrder from '@/models/GuestOrder';
import { useState } from 'react';
import AdminSidebar from '@/components/AdminSidebar';
import { useRouter } from 'next/router';
import { useToast } from '@/components/Toast';
import { formatReferenceId } from '@/lib/referenceIds';
import { authRedirect } from '@/lib/authRedirect';

export default function GuestOrderDetail({ initialOrder }){
  const [order] = useState(initialOrder || {});
  const router = useRouter();
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceRecord, setInvoiceRecord] = useState(null);
  const [invoiceForm, setInvoiceForm] = useState({ status: 'unpaid', paidAmount: 0, balance: 0 });
  const [printing, setPrinting] = useState(false);
  const toast = useToast();

  return (
    <div className="p-6">
      <div className="grid md:grid-cols-4 gap-6">
        <AdminSidebar />
        <main className="md:col-span-3">
          <button onClick={()=>router.back()} className="mb-4 px-3 py-1 border rounded">Back</button>
          <div className="flex items-center gap-3 mt-4">
            <button onClick={async ()=>{
              // open modal and load invoice if exists
              setShowInvoiceModal(true);
              setInvoiceLoading(true);
              try{
                const res = await fetch('/api/admin/invoices', { credentials: 'include' });
                const data = await res.json().catch(() => ({}));
                if(!res.ok){
                  toast?.push?.({ message: 'Unable to load invoice data', type: 'error' });
                }
                const inv = (data.invoices||[]).find(i => i.orderId === order._id);
                if(inv){
                  setInvoiceRecord(inv);
                  setInvoiceForm({ status: inv.status || 'unpaid', paidAmount: inv.paidAmount || 0, balance: inv.balance || (inv.total ? (inv.total - (inv.paidAmount||0)) : 0) });
                } else {
                  const total = order.subtotal || 0;
                  setInvoiceRecord(null);
                  setInvoiceForm({ status: 'unpaid', paidAmount: 0, balance: total });
                }
              }catch(e){
                console.error('load invoice failed', e);
                toast?.push?.({ message: 'Unable to load invoice data', type: 'error' });
                const total = order.subtotal || 0;
                setInvoiceRecord(null);
                setInvoiceForm({ status: 'unpaid', paidAmount: 0, balance: total });
              }
              setInvoiceLoading(false);
            }} className="px-3 py-1 bg-yellow-600 text-white rounded">Update invoice status</button>

            <button onClick={async ()=>{
              // download / print invoice for this guest order. Ensure invoice exists or create a temporary one.
              setPrinting(true);
              try{
                const [invRes, settingsRes] = await Promise.all([
                  fetch('/api/admin/invoices', { credentials: 'include' }),
                  fetch('/api/admin/invoice-settings', { credentials: 'include' })
                ]);
                const invBody = await invRes.json().catch(()=>({}));
                const settingsBody = await settingsRes.json().catch(()=>({}));
                let invToUse = (invBody.invoices || []).find(i => i.orderId === order._id) || invoiceRecord;
                if(!invToUse){
                  const invoiceId = new Intl.DateTimeFormat('en-CA', {
                    timeZone: 'Asia/Kolkata',
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false,
                  }).formatToParts(new Date()).reduce((acc, part) => {
                    if (part.type !== 'literal') acc[part.type] = part.value;
                    return acc;
                  }, {});
                  const invoiceDateTime = `${invoiceId.year || '0000'}${invoiceId.month || '00'}${invoiceId.day || '00'}${invoiceId.hour || '00'}${invoiceId.minute || '00'}${invoiceId.second || '00'}`;
                  const createRes = await fetch('/api/admin/invoices', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ invoiceId: `INV-${invoiceDateTime}`, type: 'guest', orderId: order._id, payload: order, subtotal: order.subtotal || 0, total: order.subtotal || 0 }) });
                  const created = await createRes.json().catch(()=>null);
                  if(!createRes.ok){
                    toast?.push?.({ message: 'Unable to create invoice', type: 'error' });
                  }
                  invToUse = created && created.invoice ? created.invoice : null;
                  if(!invToUse){
                    toast?.push?.({ message: 'Unable to generate invoice for print', type: 'error' });
                  }
                }

                const itemsHtml = (order.items || []).map(it => `<tr><td style="padding:8px;border:1px solid #ddd">${(it.title||'Item')}</td><td style="padding:8px;border:1px solid #ddd;text-align:center">${it.qty||1}</td><td style="padding:8px;border:1px solid #ddd;text-align:right">₹${(Number(it.price)||0).toFixed(2)}</td><td style="padding:8px;border:1px solid #ddd;text-align:right">₹${((Number(it.price)||0)*(Number(it.qty)||1)).toFixed(2)}</td></tr>`).join('');
                const subtotal = Number(order.subtotal || 0).toFixed(2);
                const total = Number(order.total || subtotal).toFixed(2);
                const status = invToUse?.status || invoiceForm.status || 'unpaid';
                const paidAmount = Number(invToUse?.paidAmount ?? invoiceForm.paidAmount ?? 0).toFixed(2);
                const balance = Number(invToUse?.balance ?? invoiceForm.balance ?? (Number(total) - Number(paidAmount))).toFixed(2);
                const stampColor = status === 'paid' ? '#16a34a' : (status === 'partially-paid' ? '#f59e0b' : '#ef4444');
                const stampHtml = `<div style="position:absolute;right:36px;top:40px;padding:8px 14px;border-radius:6px;background:${stampColor};color:#fff;font-weight:700;transform:rotate(-6deg);box-shadow:0 2px 6px rgba(0,0,0,0.12)">${status.toUpperCase()}</div>`;

                const invSettings = settingsBody || {};
                const invHtml = `<!doctype html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Invoice ${invToUse?.invoiceId || order._id}</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;color:#222;margin:0;padding:24px;background:#fff}
        .container{max-width:900px;margin:0 auto;padding:24px;border:1px solid #f0f0f0}
        .header{display:flex;justify-content:space-between;align-items:center}
        .brand{font-size:20px;font-weight:700;line-height:1.3;margin:0 0 4px;color:#111}
        .muted{color:#555;font-size:12px;line-height:1.5}
        table{width:100%;border-collapse:collapse;margin-top:12px}
        th,td{padding:10px;border:1px solid #eee}
        th{background:#fafafa;text-align:left}
        .right{text-align:right}
        .summary{width:360px;margin-left:auto}
        .logo{max-height:72px;max-width:72px;object-fit:contain;border-radius:4px;flex-shrink:0}
        .watermark{position:fixed;top:40%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:80px;color:rgba(0,0,0,0.04);pointer-events:none;user-select:none}
        .note{font-size:12px;color:#444;margin-top:18px}
        .footer{margin-top:28px;font-size:12px;color:#666}
        .invoice-header{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;padding:4px 2px 10px;page-break-inside:avoid}
        .brand-block{display:flex;align-items:flex-start;gap:12px;flex:1;min-width:0}
        .shop-meta{min-width:0}
        .invoice-meta{min-width:180px;text-align:right;flex-shrink:0;position:relative}
        .invoice-title{font-size:16px;font-weight:700;line-height:1.2;margin:0 0 6px;color:#111}
        .invoice-meta-line{color:#555;font-size:12px;line-height:1.6}
        .divider{border:none;border-top:1px solid #e5e7eb;margin:0 0 12px}
      </style>
    </head>
    <body>
  <div class="watermark">${invSettings?.watermarkText || 'SD Stationary invoice'}</div>
      <div class="container">
        <div class="invoice-header">
          <div class="brand-block">
            <img src="/images/logo.jpeg" class="logo" alt="logo" />
            <div class="shop-meta">
              <div class="brand">${invSettings?.brandName || 'Shree Durga Stationary'}</div>
              <div class="muted">${invSettings?.address || 'New Friends Colony, Sanjay Nagar, Sector 23, Ghaziabad, Uttar Pradesh'}</div>
              <div class="muted">Phone: ${invSettings?.phone || '9818630972'} | Email: ${invSettings?.email || 'contact.sdstationary@gmail.com'}</div>
            </div>
          </div>
          <div class="invoice-meta">
            ${stampHtml}
            <div class="invoice-title">Invoice</div>
            <div class="invoice-meta-line">Invoice ID: ${invToUse?.invoiceId || order._id}</div>
            <div class="invoice-meta-line">Date: ${new Date(order.createdAt).toLocaleString()}</div>
          </div>
        </div>

        <hr class="divider" />

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
          <div style="margin-top:6px;color:#999;font-size:12px">For any queries, contact +91-9818630972 or contact.sdstationary@gmail.com</div>
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
          </div>

          <h1 className="text-2xl font-bold mb-4">Guest Order {formatReferenceId('order', order, true)}</h1>

          <div className="bg-white p-4 rounded shadow mb-4">
            <div><strong>Name:</strong> {order.name || order.customerName || ''}</div>
            <div><strong>Phone:</strong> {order.phone || order.whatsapp || ''}</div>
            <div><strong>Email:</strong> {order.email || ''}</div>
            <div className="mt-2"><strong>Address:</strong> {order.address || ''}</div>
            <div className="mt-2"><strong>Items:</strong>
              <ul className="list-disc ml-6 mt-2">
                {(order.items||[]).map(i=> <li key={i._id || i.sku}>{i.title} × {i.qty} — ₹{i.price}</li>)}
              </ul>
            </div>
          </div>

            {showInvoiceModal && (
            <div className="modal-overlay" onClick={(e)=>{ if(e.target === e.currentTarget) setShowInvoiceModal(false); }}>
              <div className="modal-panel compact-gap" onClick={(e)=>e.stopPropagation()}>
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
                        const paid = parseFloat(e.target.value) || 0; const total = (order.subtotal || 0);
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
                        try{
                          const total = Number((invoiceRecord && invoiceRecord.total) || (order.subtotal || 0) || 0);
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
                            const invoiceParts = new Intl.DateTimeFormat('en-CA', {
                              timeZone: 'Asia/Kolkata',
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                              hour12: false,
                            }).formatToParts(new Date()).reduce((acc, part) => {
                              if (part.type !== 'literal') acc[part.type] = part.value;
                              return acc;
                            }, {});
                            const invoiceStamp = `${invoiceParts.year || '0000'}${invoiceParts.month || '00'}${invoiceParts.day || '00'}${invoiceParts.hour || '00'}${invoiceParts.minute || '00'}${invoiceParts.second || '00'}`;
                            res = await fetch('/api/admin/invoices', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ invoiceId: `INV-${invoiceStamp}`, type: 'guest', orderId: order._id, payload: order, subtotal: order.subtotal || 0, total, ...payload }) });
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
        </main>
      </div>
    </div>
  );
}

export async function getServerSideProps(ctx){
  const session = await getSession(ctx);
  if(!session || session.user?.role !== 'admin') return authRedirect(ctx);
  const { id } = ctx.params;
  await dbConnect();
  const order = await GuestOrder.findById(id).lean();
  return { props: { initialOrder: JSON.parse(JSON.stringify(order || {})) } };
}