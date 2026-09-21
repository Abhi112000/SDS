import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Pusher from 'pusher-js';

export default function AdminSidebar(){
  const router = useRouter();
  const [lowItemsProducts, setLowItemsProducts] = useState([]);
  const [tooltipVisibleProducts, setTooltipVisibleProducts] = useState(false);
  const [loadingLowProducts, setLoadingLowProducts] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);

  const activeClass = (path) => {
    const isActive = path === '/admin/messages' ? router.asPath.startsWith('/admin/messages') : router.asPath === path;
    return isActive ? 'bg-gray-100 font-semibold text-gray-900' : 'hover:bg-gray-50';
  };

  useEffect(() => {
    let isMounted = true;
    async function loadUnreadMessages(){
      try{
        const res = await fetch('/api/messages', { credentials: 'include' });
        if(!res.ok) return;
        const data = await res.json();
        const count = Array.isArray(data) ? data.filter((m) => !m.read).length : 0;
        if (isMounted) setUnreadMessages(count);
      }catch(e){
        if (isMounted) setUnreadMessages(0);
      }
    }

    loadUnreadMessages();
    const timer = setInterval(loadUnreadMessages, 15000);
    return () => { isMounted = false; clearInterval(timer); };
  }, [router.asPath]);

  async function fetchLowItems(setItems, setTooltip, setLoading){
    setLoading(true);
    try{
      const res = await fetch('/api/admin/inventory/low-stock-items', { credentials: 'include' });
      if(!res.ok) return;
      const body = await res.json();
      setItems(body.items || []);
      setTooltip(true);
    }catch(e){ /* ignore */ }
    setLoading(false);
  }

  return (
    <aside className="md:col-span-1">
      <div className="bg-white p-4 rounded shadow sticky top-6">
        <div className="mb-4">
          <div className="font-bold text-lg">Dashboard</div>
          <div className="text-sm text-gray-600">Welcome back</div>
        </div>

        <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500 mb-2">Quick actions</div>
          <div className="space-y-2 text-sm">
            <Link href="/admin" className={`block rounded px-2 py-2 text-center transition ${activeClass('/admin')}`}>Dashboard</Link>
            <Link href="/admin/order-history" className={`block rounded px-2 py-2 text-center transition ${activeClass('/admin/order-history')}`}>Orders</Link>
            <Link href="/admin/products" className={`block rounded px-2 py-2 text-center transition ${activeClass('/admin/products')}`} onMouseEnter={()=> fetchLowItems(setLowItemsProducts, setTooltipVisibleProducts, setLoadingLowProducts)} onMouseLeave={()=> setTooltipVisibleProducts(false)}>Products</Link>
            <Link href="/admin/coupons" className={`block rounded px-2 py-2 text-center transition ${activeClass('/admin/coupons')}`}>Coupons</Link>
            <Link href="/admin/inventory" className={`block rounded px-2 py-2 text-center transition ${activeClass('/admin/inventory')}`}>Inventory</Link>
            <Link href="/admin/invoice-history" className={`block rounded px-2 py-2 text-center transition ${activeClass('/admin/invoice-history')}`}>Invoices</Link>
            <Link href="/admin/invoice-settings" className={`block rounded px-2 py-2 text-center transition ${activeClass('/admin/invoice-settings')}`}>Invoice settings</Link>
            <Link href="/admin/home-banner" className={`block rounded px-2 py-2 text-center transition ${activeClass('/admin/home-banner')}`}>Home banner</Link>
            <Link href="/admin/messages" className={`flex items-center justify-center gap-2 rounded px-2 py-2 text-center transition ${activeClass('/admin/messages')}`}>
              <span>Messages</span>
              {unreadMessages > 0 && (
                <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {unreadMessages}
                </span>
              )}
            </Link>
            <Link href="/admin/users" className={`block rounded px-2 py-2 text-center transition ${activeClass('/admin/users')}`}>Users</Link>
            <Link href="/admin/sales" className={`block rounded px-2 py-2 text-center transition ${activeClass('/admin/sales')}`}>Sales</Link>
            <Link href="/admin/categories" className={`block rounded px-2 py-2 text-center transition ${activeClass('/admin/categories')}`}>Categories</Link>
          </div>
        </div>

        <div className="relative">
          {tooltipVisibleProducts && (
            <div className="absolute left-full top-0 ml-2 w-72 bg-white border rounded shadow p-2 z-50">
              <div className="flex items-center justify-between mb-1">
                <div className="font-semibold">Low stock items</div>
                {loadingLowProducts && <div className="text-xs text-gray-500">Refreshing…</div>}
              </div>
              {lowItemsProducts.length === 0 ? (
                <div className="text-sm text-gray-500">No low-stock items found.</div>
              ) : (
                <ul className="text-sm leading-tight max-h-48 overflow-auto">
                  {lowItemsProducts.map(i => (<li key={i.id} className="py-0.5">{i.name} {i.sku ? `(${i.sku})` : ''} — {i.stock}</li>))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
