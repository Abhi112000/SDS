import Link from 'next/link';
import { useEffect, useState } from 'react';
import Pusher from 'pusher-js';

export default function AdminSidebar(){
  const [lowCount, setLowCount] = useState(0);
  const [lowItemsSales, setLowItemsSales] = useState([]);
  const [lowItemsProducts, setLowItemsProducts] = useState([]);
  const [tooltipVisibleSales, setTooltipVisibleSales] = useState(false);
  const [tooltipVisibleProducts, setTooltipVisibleProducts] = useState(false);
  const [flash, setFlash] = useState(false);
  const prevLowRef = { current: 0 };

  useEffect(()=>{
    let mounted = true;

    async function fetchLow(){
      try{
        const res = await fetch('/api/admin/inventory/low-stock', { credentials: 'include' });
        if(!res.ok) return;
        const body = await res.json();
        if(mounted){
          const newCount = body.count || 0;
          // trigger flash if changed
          if(newCount !== lowCount){
            setFlash(true);
            setTimeout(()=> setFlash(false), 800);
          }
          setLowCount(newCount);
        }
      }catch(e){ /* ignore */ }
    }

    fetchLow();

  // try Pusher if env present, otherwise fallback to polling
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
    let pusherClient = null;
    let pollingId = null;

    if(typeof window !== 'undefined' && key && cluster){
      try{
        Pusher.logToConsole = false;
        pusherClient = new Pusher(key, { cluster });
        const channel = pusherClient.subscribe('inventory');
        channel.bind('inventory.update', (data) => {
          // refresh low-stock count on inventory updates
          fetchLow();
        });
      }catch(e){
        // fall back to polling
        pollingId = setInterval(fetchLow, 30000);
      }
    } else {
      pollingId = setInterval(fetchLow, 30000);
    }

    // listen for local inventory update events dispatched by sale UIs
    function onLocalInventoryUpdate(e){
      try{ fetchLow(); }catch(_){ }
    }
    if(typeof window !== 'undefined') window.addEventListener('inventory.updated', onLocalInventoryUpdate);

    return ()=>{
      mounted = false;
      if(pusherClient){
        try{ pusherClient.disconnect(); }catch(e){}
      }
      if(pollingId) clearInterval(pollingId);
      if(typeof window !== 'undefined') window.removeEventListener('inventory.updated', onLocalInventoryUpdate);
    };
  }, []);

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
          <div className="relative">
            <Link href="/admin/sales" className={`flex items-center justify-between px-3 py-2 rounded hover:bg-gray-50 ${flash ? 'animate-pulse' : ''}`} onMouseEnter={async ()=>{
                // fetch low items for sales on hover
                try{
                  const res = await fetch('/api/admin/inventory/low-stock-items', { credentials: 'include' });
                  if(res.ok){ const body = await res.json(); setLowItemsSales(body.items || []); setTooltipVisibleSales(true); }
                }catch(e){}
              }} onMouseLeave={()=>{ setTooltipVisibleSales(false); }}>
              <span>Sales</span>
              {lowCount > 0 && (
                <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium rounded-full bg-red-600 text-white">{lowCount > 99 ? '99+' : lowCount}</span>
              )}
            </Link>
            {tooltipVisibleSales && lowItemsSales && lowItemsSales.length > 0 && (
              <div className="absolute left-full top-0 ml-2 w-64 bg-white border rounded shadow p-2 z-50">
                <div className="font-semibold mb-1">Low stock items</div>
                <ul className="text-sm leading-tight max-h-48 overflow-auto">
                  {lowItemsSales.map(i => (<li key={i.id} className="py-0.5">{i.name} {i.sku ? `(${i.sku})` : ''} — {i.stock}</li>))}
                </ul>
              </div>
            )}
          </div>
          <div className="relative">
            <Link href="/admin/products" className="block px-3 py-2 rounded hover:bg-gray-50" onMouseEnter={async ()=>{
                try{
                  const res = await fetch('/api/admin/inventory/low-stock-items', { credentials: 'include' });
                  if(res.ok){ const body = await res.json(); setLowItemsProducts(body.items || []); setTooltipVisibleProducts(true); }
                }catch(e){}
              }} onMouseLeave={()=>{ setTooltipVisibleProducts(false); }}>
              Products
            </Link>
            {tooltipVisibleProducts && lowItemsProducts && lowItemsProducts.length > 0 && (
              <div className="absolute left-full top-0 ml-2 w-64 bg-white border rounded shadow p-2 z-50">
                <div className="font-semibold mb-1">Low stock items</div>
                <ul className="text-sm leading-tight max-h-48 overflow-auto">
                  {lowItemsProducts.map(i => (<li key={i.id} className="py-0.5">{i.name} {i.sku ? `(${i.sku})` : ''} — {i.stock}</li>))}
                </ul>
              </div>
            )}
          </div>
          <Link href="/admin/coupons" className="block px-3 py-2 rounded hover:bg-gray-50">Coupons</Link>
          <Link href="/admin/messages" className="block px-3 py-2 rounded hover:bg-gray-50">Messages</Link>
          <Link href="/admin/invoices" className="block px-3 py-2 rounded hover:bg-gray-50">Invoices</Link>
          <Link href="/admin/profile" className="block px-3 py-2 rounded hover:bg-gray-50">Profile</Link>
        </nav>
      </div>
    </aside>
  );
}
