import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

export default function AdminSidebar(){
  const router = useRouter();
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

  return (
    <aside className="admin-sidebar md:col-span-1">
      <div className="admin-sidebar-panel bg-white p-3 rounded shadow sticky top-3">
        <div className="mb-2">
          <div className="font-bold text-base">Dashboard</div>
          <div className="text-xs text-gray-600">Welcome back</div>
        </div>

        <div className="mb-2 rounded-lg border border-gray-200 bg-gray-50 p-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-500 mb-1">Quick actions</div>
          <div className="space-y-0.5 text-xs">
            <Link href="/admin" className={`block rounded px-2 py-1 text-center transition ${activeClass('/admin')}`}>Dashboard</Link>
            <Link href="/admin/order-history" className={`block rounded px-2 py-1 text-center transition ${activeClass('/admin/order-history')}`}>Orders</Link>
            <Link href="/admin/products" className={`block rounded px-2 py-1 text-center transition ${activeClass('/admin/products')}`}>Products</Link>
            <Link href="/admin/coupons" className={`block rounded px-2 py-1 text-center transition ${activeClass('/admin/coupons')}`}>Coupons</Link>
            <Link href="/admin/inventory" className={`block rounded px-2 py-1 text-center transition ${activeClass('/admin/inventory')}`}>Inventory</Link>
            <Link href="/admin/invoice-history" className={`block rounded px-2 py-1 text-center transition ${activeClass('/admin/invoice-history')}`}>Invoices</Link>
            <Link href="/admin/invoice-settings" className={`block rounded px-2 py-1 text-center transition ${activeClass('/admin/invoice-settings')}`}>Invoice settings</Link>
            <Link href="/admin/home-banner" className={`block rounded px-2 py-1 text-center transition ${activeClass('/admin/home-banner')}`}>Home banner</Link>
            <Link href="/admin/messages" className={`flex items-center justify-center gap-2 rounded px-2 py-1 text-center transition ${activeClass('/admin/messages')}`}>
              <span>Messages</span>
              {unreadMessages > 0 && (
                <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {unreadMessages}
                </span>
              )}
            </Link>
            <Link href="/admin/users" className={`block rounded px-2 py-1 text-center transition ${activeClass('/admin/users')}`}>Users</Link>
            <Link href="/admin/sales" className={`block rounded px-2 py-1 text-center transition ${activeClass('/admin/sales')}`}>Sales</Link>
            <Link href="/admin/ledger" className={`block rounded px-2 py-1 text-center transition ${activeClass('/admin/ledger')}`}>Ledger Book</Link>
            <Link href="/admin/categories" className={`block rounded px-2 py-1 text-center transition ${activeClass('/admin/categories')}`}>Categories</Link>
          </div>
        </div>

      </div>
    </aside>
  );
}
