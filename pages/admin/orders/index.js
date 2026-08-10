import { getSession } from 'next-auth/react';
import AdminSidebar from '@/components/AdminSidebar';
import { useEffect, useMemo, useState } from 'react';
import { useToast } from '@/components/Toast';
import { customerKey, formatReferenceId } from '@/lib/referenceIds';

export default function AdminOrders(){
  const [orders, setOrders] = useState([]);
  const [guestOrders, setGuestOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [search, setSearch] = useState('');
  const toast = useToast();

  const groupedOrders = useMemo(() => {
    const map = {};
    [...orders.map(order => ({ ...order, _isGuest: false })), ...guestOrders.map(order => ({ ...order, _isGuest: true }))].forEach(order => {
      const key = customerKey(order);
      if (!map[key]) map[key] = { key, name: order.name || order.customerName || order.userName || 'Unknown customer', phone: order.phone || order.whatsapp || 'No phone', types: new Set(), orders: [] };
      map[key].types.add(order._isGuest ? 'guest' : 'account');
      map[key].orders.push(order);
    });
    const term = search.trim().toLowerCase();
    return Object.values(map).map(group => ({ ...group, typeLabel: group.types.size > 1 ? 'Guest + Account holder' : group.types.has('guest') ? 'Guest' : 'Account holder', orders: group.orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) })).filter(group => !term || [group.name, group.phone, ...group.orders.map(order => JSON.stringify(order).toLowerCase())].join(' ').includes(term)).sort((a, b) => new Date(b.orders[0]?.createdAt) - new Date(a.orders[0]?.createdAt));
  }, [orders, guestOrders, search]);

  async function load(){
    try{
      const r = await fetch('/api/orders?admin=true', { credentials: 'include' });
      const j = await r.json();
      if(!r.ok){
        toast?.push?.({ message: 'Unable to load orders', type: 'error' });
      }
      setOrders(Array.isArray(j) ? j : (j && j.orders) || []);
      try{
        const g = await fetch('/api/admin/guest-orders', { credentials: 'include' });
        const gj = await g.json();
        if(!g.ok){
          toast?.push?.({ message: 'Unable to load guest orders', type: 'error' });
        }
        setGuestOrders(Array.isArray(gj) ? gj : (gj && gj.orders) || []);
      }catch(ge){
        console.warn('guest orders load failed', ge);
        toast?.push?.({ message: 'Unable to load guest orders', type: 'error' });
      }
    }catch(e){
      console.error('load orders failed', e);
      toast?.push?.({ message: 'Unable to load orders', type: 'error' });
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
            <h1 className="text-2xl font-bold">Orders</h1>
            <a href="/admin" className="px-3 py-1 bg-gray-100 rounded">Back</a>
          </div>

          <div className="bg-white p-4 rounded shadow mb-4">
            <label className="block text-sm font-medium mb-1">Search orders</label>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, phone, email, address, status..." className="w-full p-2 border rounded" />
          </div>

          <div className="bg-white p-4 rounded shadow">
            {loading ? (<div>Loading…</div>) : groupedOrders.length === 0 ? (<div className="text-sm text-gray-500">No orders found.</div>) : (
              <div className="space-y-3">
                {groupedOrders.map(group => (
                  <div key={group.key} className="border rounded">
                    <button type="button" onClick={()=>setExpandedGroups(prev=>({...prev, [group.key]: !prev[group.key]}))} className="w-full text-left p-4 bg-gray-50 flex items-center justify-between">
                      <div><div className="font-semibold">{group.name}</div><div className="text-sm text-gray-500">{group.phone} • {group.typeLabel}</div></div>
                      <div className="text-sm text-gray-600">{group.orders.length} order{group.orders.length === 1 ? '' : 's'} {expandedGroups[group.key] ? '▲' : '▼'}</div>
                    </button>
                    {expandedGroups[group.key] && <div className="p-3 space-y-2">{group.orders.map(order => (
                      <div key={order._id} className="p-3 border rounded flex items-center justify-between gap-3">
                        <div><div className="font-medium">{formatReferenceId('order', order, order._isGuest)} — ₹{Number(order.subtotal || 0).toFixed(2)}</div><div className="text-sm text-gray-500">{order.createdAt ? new Date(order.createdAt).toLocaleString('en-IN') : ''} • {order.status || 'guest'}</div></div>
                        <a href={`/admin/${order._isGuest ? 'guest-orders' : 'orders'}/${order._id}`} className="px-3 py-1 bg-blue-600 text-white rounded">View</a>
                      </div>
                    ))}</div>}
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
