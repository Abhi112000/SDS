import { getSession } from 'next-auth/react';
import AdminSidebar from '@/components/AdminSidebar';
import { useEffect, useState } from 'react';

export default function AdminInvoices(){
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load(){
    try{
      const r = await fetch('/api/admin/invoices', { credentials: 'include' });
      const j = await r.json();
      setInvoices((j && j.invoices) || []);
    }catch(e){ console.error('load invoices failed', e); }
    setLoading(false);
  }

  useEffect(()=>{ load(); },[]);

  return (
    <div className="p-6">
      <div className="grid md:grid-cols-4 gap-6">
        <AdminSidebar />
        <main className="md:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold">Invoices</h1>
            <a href="/admin" className="px-3 py-1 bg-gray-100 rounded">Back</a>
          </div>

          <div className="bg-white p-4 rounded shadow">
            {loading ? (<div>Loading…</div>) : (
              <div className="space-y-3">
                {invoices.length === 0 && <div className="text-sm text-gray-500">No invoices found.</div>}
                {invoices.map(inv => (
                  <div key={inv._id} className="p-3 border rounded flex items-center justify-between">
                    <div>
                      <div className="font-medium">{inv.invoiceId} — ₹{inv.total}</div>
                      <div className="text-sm text-gray-500">{inv.status} • {new Date(inv.createdAt).toISOString().replace('T',' ').slice(0,19)}</div>
                    </div>
                    <div>
                      <a href={`/admin/invoices/${inv._id || inv.invoiceId}`} className="px-3 py-1 bg-blue-600 text-white rounded">View</a>
                    </div>
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
