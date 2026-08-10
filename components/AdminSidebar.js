import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Pusher from 'pusher-js';

export default function AdminSidebar(){
  const router = useRouter();
  const [lowItemsProducts, setLowItemsProducts] = useState([]);
  const [tooltipVisibleProducts, setTooltipVisibleProducts] = useState(false);
  const [loadingLowProducts, setLoadingLowProducts] = useState(false);

  const activeClass = (path) => router.asPath === path ? 'bg-gray-100 font-semibold text-gray-900' : 'hover:bg-gray-50';

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
          <div className="font-bold text-lg">Admin</div>
          <div className="text-sm text-gray-600">Welcome back</div>
        </div>
        <nav className="space-y-2 text-sm">
          <Link href="/admin" className="block px-3 py-2 rounded hover:bg-gray-50">Dashboard</Link>
          <Link href="/admin/orders" className="block px-3 py-2 rounded hover:bg-gray-50">Orders</Link>
          <Link href="/admin/sales" className={`block px-3 py-2 rounded ${activeClass('/admin/sales')}`}>Sales</Link>
          <div className="relative">
            <Link href="/admin/products" className={`block px-3 py-2 rounded ${activeClass('/admin/products')}`} onMouseEnter={()=> fetchLowItems(setLowItemsProducts, setTooltipVisibleProducts, setLoadingLowProducts)} onMouseLeave={()=> setTooltipVisibleProducts(false)}>
              Products
            </Link>
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
          <Link href="/admin/coupons" className="block px-3 py-2 rounded hover:bg-gray-50">Coupons</Link>
          <Link href="/admin/invoices" className="block px-3 py-2 rounded hover:bg-gray-50">Invoices</Link>
          <Link href="/admin/profile" className="block px-3 py-2 rounded hover:bg-gray-50">Profile</Link>
        </nav>
      </div>
    </aside>
  );
}
