import { getSession } from 'next-auth/react';
import AdminSidebar from '@/components/AdminSidebar';
import { useEffect, useMemo, useState } from 'react';
import { useToast } from '@/components/Toast';
import { customerKey, formatReferenceId } from '@/lib/referenceIds';
import { authRedirect } from '@/lib/authRedirect';

export default function AdminInvoices(){
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [search, setSearch] = useState('');
  const [invoiceCustomer, setInvoiceCustomer] = useState(null);
  const [invoiceItems, setInvoiceItems] = useState([{ title: '', qty: 1, price: 0 }]);
  const [invoiceSettings, setInvoiceSettings] = useState(null);
  const [settingsDraft, setSettingsDraft] = useState(null);
  const [editingSettings, setEditingSettings] = useState(false);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [invoiceBusy, setInvoiceBusy] = useState(false);
  const toast = useToast();

  const groupedInvoices = useMemo(() => {
    const map = {};
    for (const inv of invoices){
      const payload = inv.payload || {};
      const name = String(payload.name || payload.customerName || payload.billingName || payload.customer?.name || inv.createdBy || '').trim() || 'Unknown customer';
      const phone = String(payload.phone || payload.whatsapp || payload.customerPhone || payload.customer?.phone || payload.billingPhone || '').trim() || 'No phone';
      const guest = payload.guest === true || payload.userId === undefined && payload.accountHolder !== true;
      const key = customerKey({ ...inv, payload: { ...payload, name, phone } }, guest);
      if(!map[key]) map[key] = { key, name, phone, guest, invoices: [], total: 0 };
      map[key].invoices.push(inv);
    }
    const groups = Object.values(map).map(group => {
      group.invoices.sort((a,b)=> new Date(b.createdAt) - new Date(a.createdAt));
      group.total = group.invoices.reduce((sum, inv) => sum + Number(inv.total || 0), 0);
      return group;
    });
    groups.sort((a,b)=> new Date(b.invoices[0]?.createdAt) - new Date(a.invoices[0]?.createdAt));
    const term = search.trim().toLowerCase();
    return groups.filter(group => !term || [group.name, group.phone, ...group.invoices.map(inv => JSON.stringify(inv.payload || {}) + ' ' + (inv.invoiceId || ''))].join(' ').toLowerCase().includes(term));
  }, [invoices, search]);

  async function load(){
    try{
      const r = await fetch('/api/admin/invoices', { credentials: 'include' });
      const j = await r.json();
      if(!r.ok){
        toast?.push?.({ message: 'Unable to load invoices', type: 'error' });
      }
      setInvoices((j && j.invoices) || []);
    }catch(e){
      console.error('load invoices failed', e);
      toast?.push?.({ message: 'Unable to load invoices', type: 'error' });
    }
    setLoading(false);
  }

  function openCustomInvoice(){
    setInvoiceCustomer({ name: '', phone: '', email: '', address: '' });
    setInvoiceItems([{ title: '', qty: 1, price: 0 }]);
  }

  useEffect(()=>{ load(); },[]);

  useEffect(()=>{
    fetch('/api/admin/invoice-settings', { credentials: 'include' }).then(r=>r.json()).then(data=>{ setInvoiceSettings(data || {}); setSettingsDraft(data || {}); }).catch(()=>{});
  },[]);

  const invoiceSubtotal = invoiceItems.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.qty || 1), 0);

  async function saveCustomerInvoice(){
    if(!invoiceCustomer?.name || !invoiceItems.some(item => item.title && Number(item.price) > 0)) return toast?.push?.({ message: 'Customer name and at least one valid item are required', type: 'error' });
    setInvoiceBusy(true);
    try{
      const payload = { name: invoiceCustomer.name, phone: invoiceCustomer.phone, email: invoiceCustomer.email, address: invoiceCustomer.address, items: invoiceItems.filter(item => item.title), subtotal: invoiceSubtotal, total: invoiceSubtotal, createdAt: new Date().toISOString() };
      const res = await fetch('/api/admin/invoices', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'custom', payload, subtotal: invoiceSubtotal, total: invoiceSubtotal }) });
      const data = await res.json();
      if(!res.ok) throw new Error(data.error || 'Invoice creation failed');
      toast?.push?.({ message: 'Invoice created successfully', type: 'success' });
      setInvoiceCustomer(null); setInvoiceItems([{ title: '', qty: 1, price: 0 }]);
      load();
    }catch(error){ toast?.push?.({ message: error.message || 'Invoice creation failed', type: 'error' }); }
    finally{ setInvoiceBusy(false); }
  }

  async function saveSettings(){
    setSettingsBusy(true);
    try{
      const res = await fetch('/api/admin/invoice-settings', { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settingsDraft) });
      const data = await res.json();
      if(!res.ok) throw new Error(data.error || 'Settings save failed');
      setInvoiceSettings(data); setSettingsDraft(data); setEditingSettings(false);
      toast?.push?.({ message: 'Invoice settings saved', type: 'success' });
    }catch(error){ toast?.push?.({ message: error.message || 'Settings save failed', type: 'error' }); }
    finally{ setSettingsBusy(false); }
  }

  return (
    <div className="p-6">
      <div className="grid md:grid-cols-4 gap-6">
        <AdminSidebar />
        <main className="md:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold">Invoices</h1>
              <p className="text-sm text-gray-600">Grouped by customer name and phone number.</p>
            </div>
            <a href="/admin" className="px-3 py-1 bg-gray-100 rounded">Back</a>
          </div>

          <div className="bg-white p-4 rounded shadow mb-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="w-full md:w-[calc(100%-210px)]">
                <label className="block text-sm font-medium mb-1">Search invoices</label>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, phone, email, address, invoice ID..." className="w-full p-2 border rounded" />
              </div>
              <button type="button" onClick={openCustomInvoice} className="w-full md:w-auto px-3 py-2 bg-blue-600 text-white rounded text-sm">Create custom invoice</button>
            </div>
          </div>

          <div className="bg-white p-4 rounded shadow">
            {loading ? (
              <div>Loading…</div>
            ) : (
              <div className="space-y-4">
                {groupedInvoices.length === 0 && <div className="text-sm text-gray-500">No invoices found.</div>}
                {groupedInvoices.map(group => (
                  <div key={group.key} className="border rounded">
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setExpandedGroups(prev => ({ ...prev, [group.key]: !prev[group.key] }))}
                      onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') setExpandedGroups(prev => ({ ...prev, [group.key]: !prev[group.key] })); }}
                      className="w-full text-left px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="text-base font-semibold">{group.name}</div>
                        <div className="text-sm text-gray-500">{group.phone} • {group.guest ? 'Guest' : 'Account holder'}</div>
                      </div>
                      <div className="text-right text-sm text-gray-700">
                        <div>{group.invoices.length} invoice{group.invoices.length === 1 ? '' : 's'}</div>
                        <div className="font-semibold">₹{group.total.toFixed(2)}</div>
                        <button type="button" onClick={()=>setInvoiceCustomer({ name: group.name, phone: group.phone === 'No phone' ? '' : group.phone, email: group.invoices[0]?.payload?.email || '', address: group.invoices[0]?.payload?.address || '' })} className="mt-2 px-2 py-1 bg-green-600 text-white rounded text-xs">Create invoice</button>
                      </div>
                    </div>
                    {expandedGroups[group.key] && (
                      <div className="px-4 py-3 space-y-3">
                        {group.invoices.map(inv => (
                          <div key={inv._id} className="rounded border p-3">
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                              <div>
                                <div className="font-medium">{formatReferenceId('invoice', inv, group.guest)}</div>
                                <div className="text-sm text-gray-500">{inv.type || inv.status || 'Saved'} • {inv.createdAt ? new Date(inv.createdAt).toISOString().replace('T',' ').slice(0,19) : 'Unknown date'}</div>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="text-sm font-semibold">₹{Number(inv.total || 0).toFixed(2)}</div>
                                <a href={`/admin/invoices/${inv._id || inv.invoiceId}`} className="px-3 py-1 bg-blue-600 text-white rounded text-sm">View</a>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <section className="bg-white p-4 rounded shadow mt-4">
            <div className="flex items-center justify-between">
              <div><h2 className="font-semibold">Invoice settings</h2><p className="text-sm text-gray-600">Settings are locked until you explicitly choose Edit.</p></div>
              {!editingSettings ? <button type="button" onClick={()=>setEditingSettings(true)} className="px-3 py-1 border rounded">Edit settings</button> : <div className="flex gap-2"><button type="button" onClick={()=>{setSettingsDraft(invoiceSettings);setEditingSettings(false);}} className="px-3 py-1 border rounded">Cancel</button><button type="button" onClick={saveSettings} disabled={settingsBusy} className="px-3 py-1 bg-blue-600 text-white rounded">{settingsBusy ? 'Saving...' : 'Save settings'}</button></div>}
            </div>
            <div className="grid md:grid-cols-2 gap-3 mt-3">
              {['brandName','address','phone','email','watermarkText'].map(field => <div key={field} className={field === 'address' || field === 'watermarkText' ? 'md:col-span-2' : ''}><label className="block text-sm capitalize">{field.replace(/([A-Z])/g, ' $1')}</label>{field === 'address' || field === 'watermarkText' ? <textarea disabled={!editingSettings} value={settingsDraft?.[field] || ''} onChange={e=>setSettingsDraft(prev=>({...prev,[field]:e.target.value}))} className="w-full p-2 border rounded" rows={2} /> : <input disabled={!editingSettings} value={settingsDraft?.[field] || ''} onChange={e=>setSettingsDraft(prev=>({...prev,[field]:e.target.value}))} className="w-full p-2 border rounded" />}</div>)}
            </div>
          </section>
        </main>
      </div>

      {invoiceCustomer && <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"><div className="bg-white rounded p-5 w-full max-w-2xl max-h-[90vh] overflow-auto"><div className="flex justify-between items-center mb-3"><h2 className="text-lg font-semibold">Create invoice for {invoiceCustomer.name}</h2><button type="button" onClick={()=>setInvoiceCustomer(null)} className="px-2 py-1 border rounded">Close</button></div><div className="grid md:grid-cols-2 gap-3"><input value={invoiceCustomer.name} onChange={e=>setInvoiceCustomer(prev=>({...prev,name:e.target.value}))} placeholder="Name" className="p-2 border rounded" /><input value={invoiceCustomer.phone} onChange={e=>setInvoiceCustomer(prev=>({...prev,phone:e.target.value}))} placeholder="Phone" className="p-2 border rounded" /><input value={invoiceCustomer.email} onChange={e=>setInvoiceCustomer(prev=>({...prev,email:e.target.value}))} placeholder="Email" className="p-2 border rounded" /><textarea value={invoiceCustomer.address} onChange={e=>setInvoiceCustomer(prev=>({...prev,address:e.target.value}))} placeholder="Address" className="p-2 border rounded md:col-span-2" /></div><h3 className="font-medium mt-4 mb-2">Items</h3>{invoiceItems.map((item,index)=><div key={index} className="grid grid-cols-12 gap-2 mb-2"><input value={item.title} onChange={e=>setInvoiceItems(prev=>prev.map((it,i)=>i===index?{...it,title:e.target.value}:it))} placeholder="Item" className="col-span-6 p-2 border rounded" /><input type="number" value={item.qty} onChange={e=>setInvoiceItems(prev=>prev.map((it,i)=>i===index?{...it,qty:Number(e.target.value)}:it))} className="col-span-2 p-2 border rounded" /><input type="number" value={item.price} onChange={e=>setInvoiceItems(prev=>prev.map((it,i)=>i===index?{...it,price:Number(e.target.value)}:it))} placeholder="Price" className="col-span-3 p-2 border rounded" /><button type="button" onClick={()=>setInvoiceItems(prev=>prev.filter((_,i)=>i!==index))} className="col-span-1 text-red-600">×</button></div>)}<button type="button" onClick={()=>setInvoiceItems(prev=>[...prev,{title:'',qty:1,price:0}])} className="px-3 py-1 border rounded">Add item</button><div className="mt-4 flex justify-between font-semibold"><span>Total</span><span>₹{invoiceSubtotal.toFixed(2)}</span></div><button type="button" onClick={saveCustomerInvoice} disabled={invoiceBusy} className="mt-4 w-full px-3 py-2 bg-green-600 text-white rounded disabled:opacity-60">{invoiceBusy ? 'Creating...' : 'Create invoice'}</button></div></div>}
    </div>
  );
}

export async function getServerSideProps(ctx){
  const session = await getSession(ctx);
  if(!session || session.user?.role !== 'admin') return authRedirect(ctx);
  return { props: {} };
}