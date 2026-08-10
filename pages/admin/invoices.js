import { getSession } from 'next-auth/react';
import AdminSidebar from '@/components/AdminSidebar';
import { useEffect, useMemo, useState } from 'react';
import { useToast } from '@/components/Toast';

export default function AdminInvoices(){
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState({});
  const toast = useToast();

  const groupedInvoices = useMemo(() => {
    const map = {};
    for (const inv of invoices){
      const payload = inv.payload || {};
      const name = String(payload.name || payload.customerName || payload.billingName || payload.customer?.name || inv.createdBy || '').trim() || 'Unknown customer';
      const phone = String(payload.phone || payload.whatsapp || payload.customerPhone || payload.customer?.phone || payload.billingPhone || '').trim() || 'No phone';
      const key = `${name}|${phone}`;
      if(!map[key]) map[key] = { key, name, phone, invoices: [], total: 0 };
      map[key].invoices.push(inv);
    }
    const groups = Object.values(map).map(group => {
      group.invoices.sort((a,b)=> new Date(b.createdAt) - new Date(a.createdAt));
      group.total = group.invoices.reduce((sum, inv) => sum + Number(inv.total || 0), 0);
      return group;
    });
    groups.sort((a,b)=> new Date(b.invoices[0]?.createdAt) - new Date(a.invoices[0]?.createdAt));
    return groups;
  }, [invoices]);

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

  useEffect(()=>{ load(); },[]);

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

          <div className="bg-white p-4 rounded shadow">
            {loading ? (
              <div>Loading…</div>
            ) : (
              <div className="space-y-4">
                {groupedInvoices.length === 0 && <div className="text-sm text-gray-500">No invoices found.</div>}
                {groupedInvoices.map(group => (
                  <div key={group.key} className="border rounded">
                    <button
                      type="button"
                      onClick={() => setExpandedGroups(prev => ({ ...prev, [group.key]: !prev[group.key] }))}
                      className="w-full text-left px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="text-base font-semibold">{group.name}</div>
                        <div className="text-sm text-gray-500">{group.phone}</div>
                      </div>
                      <div className="text-right text-sm text-gray-700">
                        <div>{group.invoices.length} invoice{group.invoices.length === 1 ? '' : 's'}</div>
                        <div className="font-semibold">₹{group.total.toFixed(2)}</div>
                      </div>
                    </button>
                    {expandedGroups[group.key] && (
                      <div className="px-4 py-3 space-y-3">
                        {group.invoices.map(inv => (
                          <div key={inv._id} className="rounded border p-3">
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                              <div>
                                <div className="font-medium">{inv.invoiceId || inv._id}</div>
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
        </main>
      </div>
    </div>
  );
}

export async function getServerSideProps(ctx){
  const session = await getSession(ctx);
  if(!session || session.user.role !== 'admin') return { redirect: { destination: '/login', permanent: false } };
  return { props: {} };
}
