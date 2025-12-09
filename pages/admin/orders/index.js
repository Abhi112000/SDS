import { getSession } from 'next-auth/react';
import AdminSidebar from '@/components/AdminSidebar';
import { useEffect, useState } from 'react';

export default function AdminOrders(){
  const [orders, setOrders] = useState([]);
  const [guestOrders, setGuestOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load(){
    try{
      const r = await fetch('/api/orders?admin=true', { credentials: 'include' });
      const j = await r.json();
      setOrders(Array.isArray(j) ? j : (j && j.orders) || []);
      try{
        const g = await fetch('/api/admin/guest-orders', { credentials: 'include' });
        const gj = await g.json();
        setGuestOrders(Array.isArray(gj) ? gj : (gj && gj.orders) || []);
      }catch(ge){ console.warn('guest orders load failed', ge); }
    }catch(e){ console.error('load orders failed', e); }
    setLoading(false);
  }

  useEffect(()=>{ load(); },[]);

  return (
    <div className="p-6">
      <div className="grid md:grid-cols-4 gap-6">
        <AdminSidebar />
        <main className="md:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold">Orders</h1>
            <a href="/admin" className="px-3 py-1 bg-gray-100 rounded">Back</a>
          </div>

          <div className="bg-white p-4 rounded shadow">
            {loading ? (<div>Loading…</div>) : (
              <div className="space-y-3">
                {orders.length === 0 && <div className="text-sm text-gray-500">No orders found.</div>}
                {orders.map(o => (
                  <div key={o._id} className="p-3 border rounded flex items-center justify-between">
                    <div>
                      <div className="font-medium">{(o.name || o.customerName || o.userName || 'Unknown')} [{o._id}] — ₹{o.subtotal}</div>
                      <div className="text-sm text-gray-500">{o.email || o.customerEmail || ''} • {o.status}</div>
                    </div>
                    <div>
                      <a href={`/admin/orders/${o._id}`} className="px-3 py-1 bg-blue-600 text-white rounded">View</a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6">
            <h2 className="text-lg font-semibold mb-3">Guest orders</h2>
            <div className="bg-white p-4 rounded shadow">
              {guestOrders.length === 0 ? (<div className="text-sm text-gray-500">No guest orders found.</div>) : (
                <div className="space-y-3">
                  {guestOrders.map(g => (
                    <div key={g._id} className="p-3 border rounded flex items-center justify-between">
                      <div>
                        <div className="font-medium">{g._id} — ₹{g.subtotal}</div>
                        <div className="text-sm text-gray-500">{g.name || g.customerName} • {g.status || 'guest'}</div>
                      </div>
                      <div>
                        <a href={`/admin/guest-orders/${g._id}`} className="px-3 py-1 bg-blue-600 text-white rounded">View</a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
