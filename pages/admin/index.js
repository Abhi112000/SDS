import { getSession } from 'next-auth/react';
import Link from 'next/link';
import dbConnect from '@/lib/mongodb';
import Order from '@/models/Order';
import Product from '@/models/Product';
import User from '@/models/User';
import GuestOrder from '@/models/GuestOrder';
import useSWR from 'swr';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useToast } from '@/components/Toast';
import Pusher from 'pusher-js';
import { mutate } from 'swr';
import AdminSidebar from '@/components/AdminSidebar';

// include credentials for admin APIs (session cookie) so server can authenticate requests
const fetcher = url => fetch(url, { credentials: 'include' }).then(r => r.json());

export default function Admin({ dbError = false, errorMessage = '' }){
  const { data: orders } = useSWR('/api/orders?admin=true', fetcher);
  const { data: messages } = useSWR('/api/messages', fetcher);
  const { data: guestOrders } = useSWR('/api/admin/guest-orders', fetcher);
  const [selectedOrder, setSelectedOrder] = useState(null);
  // Custom invoice state for admin-created offline invoices
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invName, setInvName] = useState('');
  const [invPhone, setInvPhone] = useState('');
  const [invEmail, setInvEmail] = useState('');
  const [invAddress, setInvAddress] = useState('');
  const [invItems, setInvItems] = useState([{ title: '', qty: 1, price: 0 }]);
  const [invShipping, setInvShipping] = useState(0);
  const [invTax, setInvTax] = useState(0);
  const [invDiscount, setInvDiscount] = useState(0);
  const [invDiscountLabel, setInvDiscountLabel] = useState('');
  const { data: analytics } = useSWR('/api/admin/analytics', fetcher);
  const { data: users } = useSWR('/api/admin/users', fetcher);
  const { data: productsListRaw } = useSWR('/api/products', fetcher);
  const productsList = Array.isArray(productsListRaw) ? productsListRaw : (productsListRaw && productsListRaw.products) || [];
  const { data: invoices, mutate: mutateInvoices } = useSWR('/api/admin/invoices', fetcher);
  const { data: invoiceSettings, mutate: mutateInvoiceSettings } = useSWR('/api/admin/invoice-settings', fetcher);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [settingsDraft, setSettingsDraft] = useState(null);
  const [settingsBusy, setSettingsBusy] = useState(false);

  useEffect(()=>{
    if(invoiceSettings) setSettingsDraft(invoiceSettings);
  },[invoiceSettings]);

  async function saveInvoiceSettings(){
    if(!settingsDraft) return;
    setSettingsBusy(true);
    try{
      const res = await fetch('/api/admin/invoice-settings', { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settingsDraft) });
      const body = await res.json();
      if(!res.ok) throw new Error(body?.error || 'Save failed');
      mutateInvoiceSettings();
      setSettingsBusy(false);
      toast?.push?.({ message: 'Invoice settings saved', type: 'success' });
    }catch(e){ setSettingsBusy(false); toast?.push?.({ message: 'Save failed: ' + (e.message || 'error'), type: 'error' }); }
  }
  const chartRef = useRef();
  const { data: session, status } = useSession();
  const toast = useToast();
  // Quick add product state
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [sku, setSku] = useState('');
  const [featured, setFeatured] = useState(false);
  const [description, setDescription] = useState('');
  const [image, setImage] = useState('');
  const [imagesInput, setImagesInput] = useState('');
  const [uploadProgress, setUploadProgress] = useState({});
  const [imagePreview, setImagePreview] = useState('');
  const [stock, setStock] = useState('');
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState('');

  // User action state
  const [userBusy, setUserBusy] = useState({});
  const [userMsg, setUserMsg] = useState({});

  const handleCreateProduct = useCallback(async () => {
    if(!title || !price) { setCreateMsg('Title and price required'); return; }
    setCreating(true); setCreateMsg('');
    try{
      // build images array: prefer uploaded imagePreview/url; support comma list in imagesInput as fallback
      const images = imagePreview ? [imagePreview] : (imagesInput ? imagesInput.split(',').map(i=>i.trim()).filter(Boolean) : (image ? [image] : []));
      // auto-generate SKU if empty
      let finalSku = sku && sku.trim() ? sku.trim() : '';
      if(!finalSku){
        const slug = (title + ' ' + (category||'')).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
        finalSku = (slug || 'item') + '-' + String(Date.now()).slice(-5);
      }
      const payload = { title, description, price: Number(price), sku: finalSku, image: imagePreview || image || images[0] || '', images, category, stock: Number(stock || 0), featured };
      const res = await fetch('/api/products', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if(!res.ok) throw new Error(data?.error || 'Create failed');
      toast?.push?.({ title: 'Product saved', message: 'Product has been created successfully.', type: 'success' });
      setCreateMsg('Created');
      setTitle(''); setPrice(''); setCategory(''); setSku(''); setFeatured(false); setDescription(''); setImage(''); setImagesInput(''); setStock('');
      setImagePreview(''); setUploadProgress({});
      mutate('/api/products');
    }catch(e){ setCreateMsg(e.message || 'Error'); }
    setCreating(false);
  },[title,price,category,sku,featured]);

  // upload helper: similar to admin/products uploadImage
  async function uploadImageFile(file, onProgress){
    try{
      const dataUrl = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      const resp = await fetch('/api/admin/upload-image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dataUrl }) });
      const body = await resp.json().catch(()=>null);
      if(!resp.ok){
        const msg = body && (body.error || (body.details && body.details.error) || JSON.stringify(body)) || 'upload failed';
        throw new Error(msg);
      }
      return body.secure_url || body.url || body.secureUrl || null;
    }catch(e){ console.error('uploadImageFile', e); toast?.push?.({ title: 'Upload failed', message: e.message || 'Image upload failed', type: 'error' }); return null; }
  }

  const updateUser = useCallback(async (id, patch) => {
    setUserBusy(prev=>({ ...prev, [id]: true }));
    setUserMsg(prev=>({ ...prev, [id]: '' }));
    try{
      const res = await fetch('/api/admin/users', { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...patch }) });
      const body = await res.json();
      if(!res.ok) throw new Error(body?.error || 'Update failed');
      setUserMsg(prev=>({ ...prev, [id]: 'Saved' }));
      mutate('/api/admin/users');
    }catch(e){ setUserMsg(prev=>({ ...prev, [id]: e.message || 'Error' })); }
    setUserBusy(prev=>({ ...prev, [id]: false }));
  },[]);

  // categories for quick add
  const [categories, setCategories] = useState([]);
  useEffect(()=>{ (async function(){ try{ const r = await fetch('/api/admin/categories'); const c = await r.json(); setCategories(c || []); }catch(e){} })(); },[]);

  const deleteUser = useCallback(async (id) => {
    if(!confirm('Delete user ' + id + '? This is permanent.')) return;
    setUserBusy(prev=>({ ...prev, [id]: true }));
    try{
      const res = await fetch(`/api/admin/users?id=${id}`, { method: 'DELETE', credentials: 'include' });
      const body = await res.json();
      if(!res.ok) throw new Error(body?.error || 'Delete failed');
      mutate('/api/admin/users');
    }catch(e){ setUserMsg(prev=>({ ...prev, [id]: e.message || 'Error' })); }
    setUserBusy(prev=>({ ...prev, [id]: false }));
  },[]);

  useEffect(()=>{
    // Chart removed per admin UI simplification.
  },[analytics]);

  useEffect(()=>{
    try{
      const p = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY || '', { cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || undefined });
      const ch = p.subscribe('admin-channel');
      ch.bind('new-order', (data) => {
        // revalidate admin orders
        mutate('/api/orders?admin=true');
      });
      return () => { ch.unbind(); p.disconnect(); };
    }catch(e){ console.warn('pusher client init failed', e); }
  },[]);

  // invoice helpers
  const invSubtotal = (invItems || []).reduce((s,i) => s + (Number(i.price || 0) * Number(i.qty || 1)), 0);
  const invDiscountAmount = Number(invDiscount || 0);
  const invTotal = invSubtotal - invDiscountAmount + Number(invShipping || 0) + Number(invTax || 0);

  function addInvItem(){ setInvItems(prev => ([...prev, { title: '', qty: 1, price: 0 }])); }
  function updateInvItem(idx, patch){ setInvItems(prev => prev.map((it,i)=> i===idx ? { ...it, ...patch } : it)); }
  function removeInvItem(idx){ setInvItems(prev => prev.filter((_,i)=> i!==idx)); }

  function openInvoicePanel(){ setInvoiceOpen(true); }
  function closeInvoicePanel(){ setInvoiceOpen(false); }

  function downloadInvoiceFromState(){
    const order = {
      _id: `INV-${Date.now()}`,
      name: invName,
      phone: invPhone,
      email: invEmail,
      address: invAddress,
      items: invItems,
      subtotal: invSubtotal,
      // ensure coupon object reflects the numeric discount entered by admin
      coupon: invDiscountLabel ? { code: invDiscountLabel, discountAmount: Number(invDiscount || invDiscountAmount || 0) } : null,
      shipping: Number(invShipping || 0),
      tax: Number(invTax || 0),
      total: invTotal,
      createdAt: new Date().toISOString()
    };
    const itemsHtml = (order.items || []).map(it => `<tr><td style="padding:8px;border:1px solid #ddd">${(it.title||'Item')}</td><td style="padding:8px;border:1px solid #ddd;text-align:center">${it.qty||1}</td><td style="padding:8px;border:1px solid #ddd;text-align:right">₹${(Number(it.price)||0).toFixed(2)}</td><td style="padding:8px;border:1px solid #ddd;text-align:right">₹${((Number(it.price)||0)*(Number(it.qty)||1)).toFixed(2)}</td></tr>`).join('');
    const subtotal = Number(order.subtotal || 0).toFixed(2);
    // prefer the explicit admin-entered discount value, fall back to coupon shapes
    const discountVal = Number(invDiscount ?? order.coupon?.discountAmount ?? order.coupon?.discount ?? order.coupon?.amount ?? 0);
    const discount = Number(discountVal || 0).toFixed(2);
    const shipping = Number(order.shipping || 0).toFixed(2);
    const tax = Number(order.tax || 0).toFixed(2);
    const total = Number(order.total || 0).toFixed(2);
    const invHtml = `<!doctype html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Invoice ${order._id}</title>
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
        .watermark{position:fixed;top:40%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:80px;color:rgba(0,0,0,0.04);pointer-events:none;user-select:none}
  /* keep logo intact (no cropping) by using contain and limiting size */
  .logo{max-height:80px;max-width:220px;object-fit:contain;border-radius:4px}
        .note{font-size:12px;color:#444;margin-top:18px}
        .footer{margin-top:28px;font-size:12px;color:#666}
      </style>
    </head>
    <body>
  <div class="watermark">${invoiceSettings?.watermarkText || 'SD Stationary invoice'}</div>
      <div class="container">
        <div class="header">
          <div style="display:flex;align-items:center;gap:12px">
            <img src="/images/logo.jpeg" class="logo" alt="logo" />
            <div>
              <div class="brand">${invoiceSettings?.brandName || 'Shree Durga Stationary'}</div>
              <div class="muted">${invoiceSettings?.address || 'Shop No. 12, Market Road, City Name, State - ZIP'}</div>
              <div class="muted">Phone: ${invoiceSettings?.phone || '9818630972, 8077148123'} | Email: ${invoiceSettings?.email || 'contact.sdstationary@gmail.com'}</div>
            </div>
          </div>
          <div style="text-align:right">
            <div style="font-size:14px;font-weight:700">Invoice</div>
            <div class="muted">Invoice ID: ${order._id}</div>
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
              <tr><td class="muted" style="border:none;padding:6px">Discount${order.coupon?(' ('+order.coupon.code+')'):''}</td><td class="right" style="border:none;padding:6px">- ₹${discount}</td></tr>
              <tr><td class="muted" style="border:none;padding:6px">Shipping</td><td class="right" style="border:none;padding:6px">₹${shipping}</td></tr>
              <tr><td class="muted" style="border:none;padding:6px">Tax</td><td class="right" style="border:none;padding:6px">₹${tax}</td></tr>
              <tr><td style="border-top:1px solid #ddd;padding:8px;font-weight:700">Payable</td><td style="border-top:1px solid #ddd;padding:8px;text-align:right;font-weight:700">₹${total}</td></tr>
            </tbody>
          </table>
        </div>

        <div class="note">
          <strong>Note:</strong> This is a system generated invoice and does not require a physical signature or stamp to be valid.
        </div>

        <div class="footer">
          <div>Authorized by: Shree Durga Stationary</div>
          <div style="margin-top:6px;color:#999;font-size:12px">For any queries, contact +91-9818630972 or contact.sdstationary@gmail.com</div>
        </div>
      </div>
    </body>
    </html>`;
    const w = window.open('about:blank','invoice');
    if(!w){ toast?.push?.({ message: 'Popup blocked. Allow popups to download invoice.', type: 'error' }); return; }
    w.document.write(invHtml);
    w.document.close();
    setTimeout(()=>{ try{ w.focus(); w.print(); }catch(e){} },350);
    // persist invoice in DB for admin history (non-blocking)
    try{
      fetch('/api/admin/invoices', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ invoiceId: order._id, type: 'custom', payload: order, subtotal: Number(order.subtotal||0), discount: Number(discountVal || 0), shipping: Number(order.shipping||0), tax: Number(order.tax||0), total: Number(order.total||0) }) }).then(r=>{ if(r.ok) mutateInvoices(); });
    }catch(e){ console.warn('save invoice failed', e); }
  }

  return (
    dbError ? (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Admin Dashboard — Error</h1>
        <div className="bg-white p-4 rounded shadow">
          <p className="text-red-600 font-semibold">Unable to initialize server resources.</p>
          <p className="mt-2 text-sm text-gray-700">Reason: {errorMessage || 'Database connection failed or required environment variables are missing.'}</p>
          <p className="mt-3 text-sm">Check environment variables on your deployment platform: <code>MONGODB_URI</code>, <code>NEXTAUTH_URL</code>, <code>NEXTAUTH_SECRET</code>. After correcting, redeploy to restore the admin panel.</p>
        </div>
      </div>
    ) : (
    <div className="p-6">
      <div className="grid md:grid-cols-4 gap-6">
        <AdminSidebar />
        <main className="md:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            <div className="space-x-2">
              <a href="/admin/products" className="px-3 py-1 bg-gray-100 rounded">Products</a>
              <a href="/admin/coupons" className="px-3 py-1 bg-gray-100 rounded">Coupons</a>
              <a href="/admin/inventory" className="px-3 py-1 bg-gray-100 rounded">Inventory</a>
              <a href="/admin/categories" className="px-3 py-1 bg-gray-100 rounded">Categories</a>
            </div>
          </div>
      {/* Quick add removed — use /admin/products for full product creation */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded shadow">Total Orders: {Array.isArray(orders) ? orders.length : (analytics?.orders ?? '-')}</div>
        <div className="bg-white p-4 rounded shadow">Total Products: {productsList ? productsList.length : '-'}</div>
        <div className="bg-white p-4 rounded shadow">Total Users: {Array.isArray(users?.users) ? users.users.length : (analytics?.users ?? '-')}</div>
        <div className="bg-white p-4 rounded shadow">
          <div className="font-medium">New orders (24h)</div>
          <div className="text-sm mt-2">
            {(() => {
              try{
                const since = Date.now() - (24 * 60 * 60 * 1000);
                const userNew = Array.isArray(orders) ? orders.filter(o => new Date(o.createdAt).getTime() >= since).length : 0;
                const guestNew = Array.isArray(guestOrders) ? guestOrders.filter(o => new Date(o.createdAt).getTime() >= since).length : 0;
                const totalNew = userNew + guestNew;
                return (<div><div>Total: {totalNew}</div><div className="text-xs text-gray-600">User orders: {userNew}</div><div className="text-xs text-gray-600">Guest orders: {guestNew}</div></div>);
              }catch(e){ return <div>-</div>; }
            })()}
          </div>
        </div>
      </div>

      <section className="grid md:grid-cols-2 gap-6">
        <div className="bg-white p-4 rounded shadow">
          <h3 className="font-semibold mb-2">Recent Orders</h3>
          <ul>
            {orders?.slice(0,10).map(o=> (
              <li key={o._id} className="py-2 border-b">
                <div className="flex items-center justify-between">
                  <div>{o._id} — ₹{o.subtotal} — {o.status}</div>
                  <div>
                    <button onClick={() => {
                      const el = document.getElementById('order-'+o._id);
                      if(el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
                    }} className="text-sm px-2 py-1 bg-gray-100 rounded">Details</button>
                  </div>
                </div>
                <div id={'order-'+o._id} style={{ display: 'none' }} className="mt-2 text-sm text-gray-700">
                  <div><strong>Name:</strong> {o.name}</div>
                  <div><strong>Phone:</strong> {o.phone}</div>
                  <div><strong>Email:</strong> {o.email}</div>
                  <div><strong>Address:</strong> {o.address}</div>
                  <div className="mt-2"><strong>Items:</strong>
                    <ul className="list-disc pl-6 mt-1">
                      {o.items.map(it=> (
                        <li key={it.productId}>{it.title} — {it.qty} × ₹{it.price}</li>
                      ))}
                    </ul>
                  </div>
                  {o.coupon && <div className="mt-2"><strong>Coupon:</strong> {o.coupon.code} — Discount: ₹{o.coupon.discountAmount || 0}</div>}
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">Messages</h3>
            <Link href="/admin/messages" className="text-sm text-blue-600">Manage messages</Link>
          </div>
          <ul>
            {messages?.slice(0,10).map(m=> (
              <li key={m._id} className="py-2 border-b">
                <Link href="/admin/messages" className="hover:underline text-sm">{m.fromName}: {m.subject}</Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Invoice history */}
      <section className="mt-6">
        <h3 className="text-lg font-semibold mb-2">Invoices History</h3>
        <div className="bg-white p-4 rounded shadow">
            <div className="mb-3 text-sm text-gray-600">Saved invoices created from admin or orders. Click View to open printable invoice.</div>
          <ul>
            {invoices?.invoices?.length ? invoices.invoices.map(inv => (
              <li key={inv._id} className="py-2 border-b flex items-center justify-between">
                <div>
                  <div className="text-sm">{inv.invoiceId} — ₹{(inv.total||0).toFixed(2)}</div>
                  <div className="text-xs text-gray-500">{new Date(inv.createdAt).toISOString().replace('T',' ').slice(0,19)} — {inv.type}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setSelectedInvoice(inv)} className="px-2 py-1 bg-gray-100 rounded text-sm">View</button>
                </div>
              </li>
            )) : <li className="text-sm text-gray-500">No invoices yet.</li>}
          </ul>
        </div>
      </section>

      {/* Custom Invoice creator for offline/phone orders */}
      <section className="mt-6">
        <div className="bg-white p-4 rounded shadow mb-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Create Custom Invoice</h3>
            <div>
              <button onClick={openInvoicePanel} className="px-3 py-1 bg-green-600 text-white rounded">Create Invoice</button>
            </div>
          </div>
          <p className="text-sm text-gray-600 mt-2">Create an invoice for offline purchases, fill customer and items, then download printable invoice (PDF via Print dialog).</p>
        </div>
      </section>

      {/* Invoice settings */}
      <section className="mt-6">
        <div className="bg-white p-4 rounded shadow mb-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Invoice Settings</h3>
            <div>
              <button onClick={saveInvoiceSettings} disabled={settingsBusy} className="px-3 py-1 bg-blue-600 text-white rounded">{settingsBusy? 'Saving...' : 'Save Settings'}</button>
            </div>
          </div>
          <p className="text-sm text-gray-600 mt-2">Configure header, logo and watermark used in printable invoices.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <div>
              <label className="block text-sm">Brand name</label>
              <input value={settingsDraft?.brandName || ''} onChange={e=>setSettingsDraft(prev=>({ ...(prev||{}), brandName: e.target.value }))} className="p-2 border rounded w-full" />
            </div>
            {/* Logo path removed — invoices will use /images/logo.jpeg by default */}
            <div className="md:col-span-2">
              <label className="block text-sm">Address</label>
              <textarea value={settingsDraft?.address || ''} onChange={e=>setSettingsDraft(prev=>({ ...(prev||{}), address: e.target.value }))} className="p-2 border rounded w-full" rows={2} />
            </div>
            <div>
              <label className="block text-sm">Phone</label>
              <input value={settingsDraft?.phone || ''} onChange={e=>setSettingsDraft(prev=>({ ...(prev||{}), phone: e.target.value }))} className="p-2 border rounded w-full" />
            </div>
            <div>
              <label className="block text-sm">Email</label>
              <input value={settingsDraft?.email || ''} onChange={e=>setSettingsDraft(prev=>({ ...(prev||{}), email: e.target.value }))} className="p-2 border rounded w-full" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm">Watermark text</label>
              <input value={settingsDraft?.watermarkText || ''} onChange={e=>setSettingsDraft(prev=>({ ...(prev||{}), watermarkText: e.target.value }))} className="p-2 border rounded w-full" />
            </div>
          </div>
        </div>
      </section>

      {/* Invoice modal/form */}
      {invoiceOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 p-6 overflow-auto">
          <div className="bg-white p-4 rounded max-w-3xl w-full">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">New Invoice</h3>
              <div className="flex items-center gap-2">
                <button onClick={() => { downloadInvoiceFromState(); }} className="px-3 py-1 bg-blue-600 text-white rounded">Download Invoice (PDF)</button>
                <button onClick={closeInvoicePanel} className="px-3 py-1 bg-gray-100 rounded">Close</button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm">Customer name</label>
                <input value={invName} onChange={e=>setInvName(e.target.value)} placeholder="Full name" className="p-2 border rounded w-full" />
              </div>
              <div>
                <label className="block text-sm">Customer phone</label>
                <input value={invPhone} onChange={e=>setInvPhone(e.target.value)} placeholder="Mobile number" className="p-2 border rounded w-full" />
              </div>
              <div>
                <label className="block text-sm">Customer email</label>
                <input value={invEmail} onChange={e=>setInvEmail(e.target.value)} placeholder=" Email (optional)" className="p-2 border rounded w-full" />
              </div>
              <div>
                <label className="block text-sm">Shipping charge (₹)</label>
                <input value={invShipping} onChange={e=>setInvShipping(e.target.value)} placeholder="0.00" className="p-2 border rounded w-full" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm">Billing address</label>
                <textarea value={invAddress} onChange={e=>setInvAddress(e.target.value)} placeholder="Street, city, state, ZIP" className="p-2 border rounded w-full" rows={2} />
              </div>
            </div>

            <div className="mt-4">
              <h4 className="font-medium mb-2">Items</h4>
              <div className="grid grid-cols-12 gap-2 font-semibold text-sm mb-2">
                <div className="col-span-6">Description</div>
                <div className="col-span-2 text-center">Qty</div>
                <div className="col-span-2 text-right">Unit price (₹)</div>
                <div className="col-span-2">&nbsp;</div>
              </div>
              <div className="space-y-2">
                {invItems.map((it, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <input value={it.title} onChange={e=>updateInvItem(idx, { title: e.target.value })} placeholder="Item description" className="col-span-6 p-2 border rounded" aria-label={`Item ${idx+1} description`} />
                    <input type="number" value={it.qty} onChange={e=>updateInvItem(idx, { qty: Number(e.target.value || 0) })} className="col-span-2 p-2 border rounded" placeholder="Qty" aria-label={`Item ${idx+1} quantity`} />
                    <input type="number" value={it.price} onChange={e=>updateInvItem(idx, { price: Number(e.target.value || 0) })} className="col-span-2 p-2 border rounded" placeholder="Unit price (₹)" aria-label={`Item ${idx+1} unit price`} />
                    <div className="col-span-2 flex gap-2">
                      <button onClick={()=>removeInvItem(idx)} className="p-2 bg-red-100 rounded text-sm">Remove item</button>
                    </div>
                  </div>
                ))}
                <div>
                  <button onClick={addInvItem} className="px-3 py-1 bg-gray-100 rounded">Add item</button>
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm">Discount amount (₹)</label>
                <input type="number" value={invDiscount} onChange={e=>setInvDiscount(Number(e.target.value || 0))} placeholder="0.00" className="p-2 border rounded w-full" />
              </div>
              <div>
                <label className="block text-sm">Discount label / code (optional)</label>
                <input value={invDiscountLabel} onChange={e=>setInvDiscountLabel(e.target.value)} placeholder="Coupon code or note" className="p-2 border rounded w-full" />
              </div>
              <div>
                <label className="block text-sm">Tax amount (₹)</label>
                <input type="number" value={invTax} onChange={e=>setInvTax(Number(e.target.value || 0))} placeholder="0.00" className="p-2 border rounded w-full" />
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <div className="w-72">
                <div className="flex justify-between py-1"><span className="text-gray-600">Subtotal</span><span>₹{invSubtotal.toFixed(2)}</span></div>
                <div className="flex justify-between py-1"><span className="text-gray-600">Discount</span><span>- ₹{invDiscountAmount.toFixed(2)}</span></div>
                <div className="flex justify-between py-1"><span className="text-gray-600">Shipping</span><span>₹{Number(invShipping || 0).toFixed(2)}</span></div>
                <div className="flex justify-between py-1"><span className="text-gray-600">Tax</span><span>₹{Number(invTax || 0).toFixed(2)}</span></div>
                <div className="border-t mt-2 pt-2 flex justify-between font-semibold"><span>Payable</span><span>₹{invTotal.toFixed(2)}</span></div>
              </div>
            </div>
          </div>
        </div>
      )}
      <section className="mt-6">
        <h3 className="text-lg font-semibold mb-2">Guest Orders</h3>
        <div className="bg-white p-4 rounded shadow">
          <ul>
            {guestOrders?.slice(0,20).map(g=> (
              <li key={g._id} className="py-2 border-b flex items-center justify-between">
                <div>
                  <div className="text-sm">{g._id}</div>
                  <div className="text-sm text-gray-700">{g.name} — ₹{g.subtotal}</div>
                  <div className="text-xs text-gray-500">{new Date(g.createdAt || g.createdAt).toISOString().replace('T',' ').slice(0,19)}</div>
                </div>
                <div>
                  <button onClick={() => setSelectedOrder(g)} className="px-2 py-1 bg-gray-100 rounded text-sm">View details</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Modal for selected guest order details */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-4 rounded max-w-2xl w-full">
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-semibold">Order Details</h4>
              <button onClick={() => setSelectedOrder(null)} className="text-gray-600">Close</button>
            </div>
            <div className="text-sm text-gray-700">
              <div className="mb-3">
                <div><strong>Order ID:</strong> {selectedOrder._id}</div>
                <div><strong>Name:</strong> {selectedOrder.name}</div>
                <div><strong>Phone:</strong> {selectedOrder.phone}</div>
                <div><strong>Email:</strong> {selectedOrder.email}</div>
                <div><strong>Address:</strong> {selectedOrder.address}</div>
                <div><strong>Placed:</strong> {selectedOrder?.createdAt ? new Date(selectedOrder.createdAt).toISOString().replace('T',' ').slice(0,19) : ''}</div>
              </div>

              {/* Items table with line totals */}
              <div>
                <table className="w-full text-sm table-auto border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="p-2 text-left">Product</th>
                      <th className="p-2 text-center">Qty</th>
                      <th className="p-2 text-right">Unit</th>
                      <th className="p-2 text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedOrder.items || []).map((it, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="p-2">{it.title || it.name || 'Item'}</td>
                        <td className="p-2 text-center">{it.qty || 1}</td>
                        <td className="p-2 text-right">₹{(Number(it.price) || 0).toFixed(2)}</td>
                        <td className="p-2 text-right">₹{((Number(it.price) || 0) * (Number(it.qty) || 1)).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals and breakdown */}
              <div className="mt-4 flex justify-end">
                <div className="w-72">
                  <div className="flex justify-between py-1"><span className="text-gray-600">Subtotal</span><span>₹{(selectedOrder.subtotal || 0).toFixed(2)}</span></div>
                  <div className="flex justify-between py-1"><span className="text-gray-600">Discount{selectedOrder.coupon ? ` (${selectedOrder.coupon.code})` : ''}</span><span>- ₹{(selectedOrder.coupon?.discountAmount || 0).toFixed(2)}</span></div>
                  <div className="flex justify-between py-1"><span className="text-gray-600">Shipping</span><span>₹{(selectedOrder.shipping || 0).toFixed(2)}</span></div>
                  <div className="flex justify-between py-1"><span className="text-gray-600">Tax</span><span>₹{(selectedOrder.tax || 0).toFixed(2)}</span></div>
                  <div className="border-t mt-2 pt-2 flex justify-between font-semibold"><span>Payable</span><span>₹{((selectedOrder.total) ?? ((selectedOrder.subtotal || 0) - (selectedOrder.coupon?.discountAmount || 0) + (selectedOrder.shipping || 0) + (selectedOrder.tax || 0))).toFixed(2)}</span></div>
                </div>
              </div>

              <div className="mt-4 flex gap-2 justify-end">
                <button onClick={() => {
                  // generate printable invoice HTML with breakdown
                  const itemsHtml = (selectedOrder.items || []).map(it => `<tr><td style="padding:8px;border:1px solid #ddd">${(it.title||it.name||'Item')}</td><td style="padding:8px;border:1px solid #ddd;text-align:center">${it.qty||1}</td><td style="padding:8px;border:1px solid #ddd;text-align:right">₹${(Number(it.price)||0).toFixed(2)}</td><td style="padding:8px;border:1px solid #ddd;text-align:right">₹${((Number(it.price)||0)*(Number(it.qty)||1)).toFixed(2)}</td></tr>`).join('');
                  const subtotal = Number(selectedOrder.subtotal || 0).toFixed(2);
                  // support different coupon shapes (discountAmount, discount, amount)
                  const discount = Number(selectedOrder.coupon?.discountAmount ?? selectedOrder.coupon?.discount ?? selectedOrder.coupon?.amount ?? 0).toFixed(2);
                  const shipping = Number(selectedOrder.shipping || 0).toFixed(2);
                  const tax = Number(selectedOrder.tax || 0).toFixed(2);
                  const total = Number((selectedOrder.total) ?? ((selectedOrder.subtotal || 0) - (selectedOrder.coupon?.discountAmount || 0) + (selectedOrder.shipping || 0) + (selectedOrder.tax || 0))).toFixed(2);
                  const invHtml = `<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${selectedOrder._id}</title><style>body{font-family:Arial,Helvetica,sans-serif;color:#222;padding:20px}h1{font-size:20px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ddd;padding:8px}</style></head><body><div style="display:flex;justify-content:space-between;align-items:center"><div><h1>Invoice</h1><div>Order ID: ${selectedOrder._id}</div><div>Placed: ${new Date(selectedOrder.createdAt).toLocaleString()}</div></div><div style="text-align:right"><strong>Shree Durga Stationary</strong><div class="muted">Admin invoice</div></div></div><hr/><h3>Customer</h3><div>${selectedOrder.name || ''}<br/>${selectedOrder.email || ''}<br/>${selectedOrder.phone || ''}<br/>${selectedOrder.address || ''}</div><h3>Items</h3><table><thead><tr><th style="padding:8px;border:1px solid #ddd;text-align:left">Product</th><th style="padding:8px;border:1px solid #ddd;text-align:center">Qty</th><th style="padding:8px;border:1px solid #ddd;text-align:right">Unit</th><th style="padding:8px;border:1px solid #ddd;text-align:right">Line Total</th></tr></thead><tbody>${itemsHtml}</tbody></table><div style="width:320px;margin-left:auto;margin-top:12px"><table style="width:100%;border-collapse:collapse"><tr><td style="padding:6px">Subtotal</td><td style="padding:6px;text-align:right">₹${subtotal}</td></tr><tr><td style="padding:6px">Discount${selectedOrder.coupon?(' ('+selectedOrder.coupon.code+')'):''}</td><td style="padding:6px;text-align:right">- ₹${discount}</td></tr><tr><td style="padding:6px">Shipping</td><td style="padding:6px;text-align:right">₹${shipping}</td></tr><tr><td style="padding:6px">Tax</td><td style="padding:6px;text-align:right">₹${tax}</td></tr><tr><td style="padding:6px;font-weight:700;border-top:1px solid #ddd">Payable</td><td style="padding:6px;text-align:right;font-weight:700;border-top:1px solid #ddd">₹${total}</td></tr></table></div><div style="clear:both;margin-top:40px"><small style="color:#666">This is a system generated invoice.</small></div></body></html>`;
                  const w = window.open('about:blank','invoice');
                  if(!w){ toast?.push?.({ message: 'Popup blocked. Allow popups to download invoice.', type: 'error' }); return; }
                  w.document.write(invHtml);
                  w.document.close();
                  setTimeout(()=>{ try{ w.focus(); w.print(); }catch(e){} },350);
                  // save invoice record for history
                  try{
                    fetch('/api/admin/invoices', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ invoiceId: selectedOrder._id, type: 'order', orderId: selectedOrder._id, payload: selectedOrder, subtotal: Number(selectedOrder.subtotal||0), discount: Number(selectedOrder.coupon?.discountAmount ?? selectedOrder.coupon?.discount ?? selectedOrder.coupon?.amount ?? 0), shipping: Number(selectedOrder.shipping||0), tax: Number(selectedOrder.tax||0), total: Number(selectedOrder.total||0) }) }).then(r=>{ if(r.ok) mutateInvoices(); });
                  }catch(e){ console.warn('save order-invoice failed', e); }
                }} className="px-3 py-1 bg-blue-600 text-white rounded">Download Invoice (PDF)</button>
                <button onClick={() => setSelectedOrder(null)} className="px-3 py-1 bg-gray-100 rounded">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal to view saved invoice from history */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-4 rounded max-w-3xl w-full">
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-semibold">Invoice {selectedInvoice.invoiceId}</h4>
              <button onClick={() => setSelectedInvoice(null)} className="text-gray-600">Close</button>
            </div>
            <div className="text-sm text-gray-700">
              <div className="mb-3">
                <div><strong>Saved:</strong> {selectedInvoice?.createdAt ? new Date(selectedInvoice.createdAt).toISOString().replace('T',' ').slice(0,19) : ''}</div>
                <div><strong>Type:</strong> {selectedInvoice.type}</div>
                <div><strong>Total:</strong> ₹{(selectedInvoice.total||0).toFixed(2)}</div>
              </div>
              <div className="mt-4 flex gap-2 justify-end">
                <button onClick={() => {
                  const order = selectedInvoice.payload || {};
                  const itemsHtml = (order.items || []).map(it => `<tr><td style="padding:8px;border:1px solid #ddd">${(it.title||it.name||'Item')}</td><td style="padding:8px;border:1px solid #ddd;text-align:center">${it.qty||1}</td><td style="padding:8px;border:1px solid #ddd;text-align:right">₹${(Number(it.price)||0).toFixed(2)}</td><td style="padding:8px;border:1px solid #ddd;text-align:right">₹${((Number(it.price)||0)*(Number(it.qty)||1)).toFixed(2)}</td></tr>`).join('');
                  const subtotal = Number(order.subtotal || selectedInvoice.subtotal || 0).toFixed(2);
                  // avoid mixing ?? and || without parentheses
                  const discount = Number((order.coupon?.discountAmount ?? order.coupon?.discount ?? order.coupon?.amount ?? selectedInvoice.discount) || 0).toFixed(2);
                  const shipping = Number(order.shipping || selectedInvoice.shipping || 0).toFixed(2);
                  const tax = Number(order.tax || selectedInvoice.tax || 0).toFixed(2);
                  const total = Number(selectedInvoice.total || order.total || 0).toFixed(2);
                  // try to surface coupon code / label from order payload or invoice record
                  const couponCode = (order?.coupon?.code) || (selectedInvoice?.payload?.coupon?.code) || (selectedInvoice?.discountLabel) || '';
                  const invHtml = `<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${selectedInvoice.invoiceId}</title><style>body{font-family:Arial,Helvetica,sans-serif;color:#222;padding:20px}h1{font-size:20px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ddd;padding:8px}.watermark{position:fixed;top:40%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:80px;color:rgba(0,0,0,0.04);pointer-events:none}.logo{max-height:80px;max-width:220px;object-fit:contain;border-radius:4px}</style></head><body><div class="watermark">${invoiceSettings?.watermarkText || 'SD Stationary invoice'}</div><div style="display:flex;justify-content:space-between;align-items:center"><div style="display:flex;align-items:center;gap:12px"><img src="${invoiceSettings?.logoPath || '/images/logo.jpeg'}" class="logo" alt="logo" /><div><h1>${invoiceSettings?.brandName || 'Shree Durga Stationary'}</h1><div>${invoiceSettings?.address || ''}</div><div>Phone: ${invoiceSettings?.phone || ''} | Email: ${invoiceSettings?.email || ''}</div></div></div><div style="text-align:right"><div>Invoice: ${selectedInvoice.invoiceId}</div><div>Date: ${new Date(selectedInvoice.createdAt).toLocaleString()}</div></div></div><hr/><h3>Customer</h3><div>${order.name || ''}<br/>${order.email || ''}<br/>${order.phone || ''}<br/>${order.address || ''}</div><h3>Items</h3><table><thead><tr><th style="padding:8px;border:1px solid #ddd;text-align:left">Product</th><th style="padding:8px;border:1px solid #ddd;text-align:center">Qty</th><th style="padding:8px;border:1px solid #ddd;text-align:right">Unit</th><th style="padding:8px;border:1px solid #ddd;text-align:right">Line Total</th></tr></thead><tbody>${itemsHtml}</tbody></table><div style="width:320px;margin-left:auto;margin-top:12px"><table style="width:100%;border-collapse:collapse"><tr><td style="padding:6px">Subtotal</td><td style="padding:6px;text-align:right">₹${subtotal}</td></tr><tr><td style="padding:6px">Discount${couponCode?(' ('+couponCode+')'):''}</td><td style="padding:6px;text-align:right">- ₹${discount}</td></tr><tr><td style="padding:6px">Shipping</td><td style="padding:6px;text-align:right">₹${shipping}</td></tr><tr><td style="padding:6px">Tax</td><td style="padding:6px;text-align:right">₹${tax}</td></tr><tr><td style="padding:6px;font-weight:700;border-top:1px solid #ddd">Payable</td><td style="padding:6px;text-align:right;font-weight:700;border-top:1px solid #ddd">₹${total}</td></tr></table></div><div style="clear:both;margin-top:40px"><small style="color:#666">This is a system generated invoice.</small></div></body></html>`;
                  const w = window.open('about:blank','invoice');
                  if(!w){ toast?.push?.({ message: 'Popup blocked. Allow popups to download invoice.', type: 'error' }); return; }
                  w.document.write(invHtml);
                  w.document.close();
                  setTimeout(()=>{ try{ w.focus(); w.print(); }catch(e){} },350);
                }} className="px-3 py-1 bg-blue-600 text-white rounded">View / Download</button>
                <button onClick={() => setSelectedInvoice(null)} className="px-3 py-1 bg-gray-100 rounded">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <section className="mt-6">
        <h3 className="text-lg font-semibold mb-2">Users</h3>
        <div className="bg-white p-4 rounded shadow">
          <table className="w-full text-sm">
            <thead><tr><th className="text-left p-2">ID</th><th className="text-left p-2">Name</th><th className="text-left p-2">Email</th><th className="text-left p-2">Role</th><th className="text-left p-2">Actions</th></tr></thead>
            <tbody>
              {users?.users?.map(u => (
                <tr key={u._id} className="border-b">
                  <td className="p-2 break-words max-w-[200px]">{u._id}</td>
                  <td className="p-2">{u.name}</td>
                  <td className="p-2">{u.email}</td>
                  <td className="p-2">
                    <select value={u.role} onChange={e=>updateUser(u._id, { role: e.target.value })} className="p-1 border rounded">
                      <option value="user">user</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1"><input type="checkbox" checked={!!u.disabled} onChange={e=>updateUser(u._id, { disabled: e.target.checked })} /> Disabled</label>
                      <button disabled={!!userBusy[u._id]} onClick={()=>deleteUser(u._id)} className="text-sm text-red-600">Delete</button>
                      <span className="text-xs text-gray-500">{userMsg[u._id]}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Recent orders chart removed */}
        </main>
      </div>
    </div>
    )
  );
}

export async function getServerSideProps(ctx){
  const session = await getSession(ctx);
  // guard session.user safely to avoid server crashes when the session shape is unexpected
  if(!session || session.user?.role !== 'admin') return { redirect: { destination: '/login', permanent: false } };
  try{
    await dbConnect();
    return { props: {} };
  }catch(e){
    // log server-side so Vercel shows the reason in function logs
    try{ console.error('[admin] getServerSideProps dbConnect failed', e?.message || e); }catch(__){}
    // return a non-500 friendly response and display instructions to fix env
    return { props: { dbError: true, errorMessage: (e?.message || String(e)) } };
  }
}
