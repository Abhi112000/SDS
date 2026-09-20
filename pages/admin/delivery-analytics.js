import { useEffect, useState, useRef } from 'react';
import dbConnect from '@/lib/mongodb';

export default function DeliveryAnalyticsPage(){
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [localityItems, setLocalityItems] = useState([]);
  const [localityTotal, setLocalityTotal] = useState(0);
  const [localityPageNum, setLocalityPageNum] = useState(1);
  const [localityPageSize, setLocalityPageSize] = useState(25);
  const [localitySortField, setLocalitySortField] = useState('totalOrders');
  const [localitySortOrder, setLocalitySortOrder] = useState('desc');
  const dayChartRef = useRef();
  const monthChartRef = useRef();

  useEffect(()=>{ fetchData(); }, [localityPageNum, localityPageSize, localitySortField, localitySortOrder]);

  async function fetchData(){
    setLoading(true);
    try{
      const qs = new URLSearchParams({ lastDays: '30', page: String(localityPageNum), pageSize: String(localityPageSize), localitySort: localitySortField, localityOrder: localitySortOrder });
      const res = await fetch('/api/admin/analytics/delivery?' + qs.toString());
      const json = await res.json();
      setData(json);
      // locality may be paginated object
      if(json && json.locality){
        if(Array.isArray(json.locality)){
          setLocalityItems(json.locality || []);
          setLocalityTotal((json.locality||[]).length || 0);
        }else{
          setLocalityItems(json.locality.items || []);
          setLocalityTotal(json.locality.total || 0);
        }
      }
      setLoading(false);
      // lazy load Chart.js for simple visualisations
      if(typeof window !== 'undefined' && !window.Chart){
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/chart.js';
        s.onload = ()=>{ renderCharts(json); };
        document.body.appendChild(s);
      }else{ renderCharts(json); }
    }catch(e){ setLoading(false); console.error(e); }
  }

  function renderCharts(json){
    try{
      if(!json) return;
      const days = (json.ordersByDay || []).map(d=>d._id);
      const dayCounts = (json.ordersByDay || []).map(d=>d.count);
      const months = (json.ordersByMonth || []).map(d=>d._id);
      const monthCounts = (json.ordersByMonth || []).map(d=>d.count);
      if(window.Chart){
        if(dayChartRef.current){
          try{ new window.Chart(dayChartRef.current.getContext('2d'), { type: 'bar', data: { labels: days, datasets: [{ label: 'Orders', data: dayCounts, backgroundColor: '#4f46e5' }] }, options: { maintainAspectRatio: false } }); }catch(e){}
        }
        if(monthChartRef.current){
          try{ new window.Chart(monthChartRef.current.getContext('2d'), { type: 'bar', data: { labels: months, datasets: [{ label: 'Orders', data: monthCounts, backgroundColor: '#f97316' }] }, options: { maintainAspectRatio: false } }); }catch(e){}
        }
      }
    }catch(e){ console.warn(e); }
  }

  function toggleLocalitySort(field){
    if(field === localitySortField){
      setLocalitySortOrder(o => o === 'asc' ? 'desc' : 'asc');
    } else {
      setLocalitySortField(field);
      setLocalitySortOrder('desc');
    }
    setLocalityPageNum(1);
  }

  function exportLocalityCSV(){
    if(!data) return;
    const rows = localityItems || [];
    const header = ['Locality','Total Orders','Total Revenue','Avg Order Value','Free Deliveries','Paid Deliveries','Last Order Date','Avg Distance'];
    const csv = [header.join(',')].concat(rows.map(r=>[
      `"${r.locality}"`, r.totalOrders, r.totalRevenue || 0, (r.avgOrderValue||0).toFixed(2), r.freeDeliveries, r.paidDeliveries, r.lastOrderDate ? new Date(r.lastOrderDate).toISOString() : '', (r.avgDistance||'')
    ].join(','))).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'locality-analytics.csv'; a.click(); URL.revokeObjectURL(url);
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-semibold mb-4">Delivery Analytics</h1>
      {loading && <div>Loading…</div>}
      {!loading && data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
            <div className="p-3 bg-white rounded shadow">
              <div className="text-sm text-slate-500">Total Orders</div>
              <div className="text-xl font-bold">{data.totals.totalOrders || 0}</div>
            </div>
            <div className="p-3 bg-white rounded shadow">
              <div className="text-sm text-slate-500">Home Delivery Orders</div>
              <div className="text-xl font-bold">{data.totals.homeDeliveryOrders || 0}</div>
            </div>
            <div className="p-3 bg-white rounded shadow">
              <div className="text-sm text-slate-500">Self Pickup Orders</div>
              <div className="text-xl font-bold">{data.totals.selfPickupOrders || 0}</div>
            </div>
            <div className="p-3 bg-white rounded shadow">
              <div className="text-sm text-slate-500">Cancelled Orders</div>
              <div className="text-xl font-bold">{data.totals.cancelledOrders || 0}</div>
            </div>
            <div className="p-3 bg-white rounded shadow">
              <div className="text-sm text-slate-500">Rejected Orders</div>
              <div className="text-xl font-bold">{data.totals.rejectedOrders || 0}</div>
            </div>
            <div className="p-3 bg-white rounded shadow">
              <div className="text-sm text-slate-500">Free Delivery Orders</div>
              <div className="text-xl font-bold">{data.totals.freeDeliveryOrders || 0}</div>
            </div>
            <div className="p-3 bg-white rounded shadow">
              <div className="text-sm text-slate-500">Paid Delivery Orders</div>
              <div className="text-xl font-bold">{data.totals.paidDeliveryOrders || 0}</div>
            </div>
            <div className="p-3 bg-white rounded shadow">
              <div className="text-sm text-slate-500">Total Delivery Charges</div>
              <div className="text-xl font-bold">₹{(data.totals.totalDeliveryCharges||0).toFixed(2)}</div>
            </div>
            <div className="p-3 bg-white rounded shadow">
              <div className="text-sm text-slate-500">Average Order Value (AOV)</div>
              <div className="text-xl font-bold">₹{(data.totals.avgOrderValue||0).toFixed(2)}</div>
            </div>
            <div className="p-3 bg-white rounded shadow">
              <div className="text-sm text-slate-500">Average Delivery Distance (km)</div>
              <div className="text-xl font-bold">{(data.totals.avgDeliveryDistance||0).toFixed(2)}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <div className="bg-white p-4 rounded shadow">
              <h3 className="text-sm font-medium mb-2">Orders by Day</h3>
              <div style={{height:220}}>
                <canvas ref={dayChartRef}></canvas>
              </div>
            </div>
            <div className="bg-white p-4 rounded shadow">
              <h3 className="text-sm font-medium mb-2">Orders by Month</h3>
              <div style={{height:220}}>
                <canvas ref={monthChartRef}></canvas>
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded shadow mb-6">
            <h3 className="text-lg font-medium mb-2">Top Selling Products</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead><tr><th>Product</th><th>Qty</th><th>Revenue</th></tr></thead>
                <tbody>
                  {(data.topProducts||[]).map(p=> (
                    <tr key={p._id}><td className="py-1">{p.title || 'Unknown'}</td><td>{p.qty}</td><td>₹{(p.revenue||0).toFixed(2)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white p-4 rounded shadow mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-medium">Locality Analytics</h3>
              <div className="flex gap-2">
                <button onClick={exportLocalityCSV} className="px-3 py-1 bg-indigo-600 text-white rounded">Export CSV</button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="cursor-pointer" onClick={()=>toggleLocalitySort('locality')}>Locality {localitySortField==='locality' ? (localitySortOrder==='asc' ? '▲' : '▼') : ''}</th>
                    <th className="cursor-pointer" onClick={()=>toggleLocalitySort('totalOrders')}>Orders {localitySortField==='totalOrders' ? (localitySortOrder==='asc' ? '▲' : '▼') : ''}</th>
                    <th className="cursor-pointer" onClick={()=>toggleLocalitySort('totalRevenue')}>Revenue {localitySortField==='totalRevenue' ? (localitySortOrder==='asc' ? '▲' : '▼') : ''}</th>
                    <th>AOV</th>
                    <th>Free</th>
                    <th>Paid</th>
                    <th>Last Order</th>
                    <th className="cursor-pointer" onClick={()=>toggleLocalitySort('avgDistance')}>Avg Dist (km) {localitySortField==='avgDistance' ? (localitySortOrder==='asc' ? '▲' : '▼') : ''}</th>
                  </tr>
                </thead>
                <tbody>
                  {(localityItems||[]).map(r=> (
                    <tr key={r.locality}><td className="py-1">{r.locality}</td><td>{r.totalOrders}</td><td>₹{(r.totalRevenue||0).toFixed(2)}</td><td>₹{(r.avgOrderValue||0).toFixed(2)}</td><td>{r.freeDeliveries}</td><td>{r.paidDeliveries}</td><td>{r.lastOrderDate ? new Date(r.lastOrderDate).toLocaleString() : '-'}</td><td>{(r.avgDistance||'').toString()}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between mt-3">
              <div className="text-sm text-slate-600">Showing page {localityPageNum} • {localityTotal} results</div>
              <div className="flex items-center gap-2">
                <button className="px-2 py-1 border rounded" disabled={localityPageNum<=1} onClick={()=>setLocalityPageNum(p=>Math.max(1,p-1))}>Prev</button>
                <button className="px-2 py-1 border rounded" disabled={(localityPageNum*localityPageSize)>=localityTotal} onClick={()=>setLocalityPageNum(p=>p+1)}>Next</button>
                <select value={String(localityPageSize)} onChange={e=>{ setLocalityPageSize(Number(e.target.value)); setLocalityPageNum(1); }} className="px-2 py-1 border rounded">
                  <option value="10">10</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                </select>
              </div>
            </div>
          </div>

        </>
      )}
    </div>
  );
}

function toggleLocalitySort(field){
  // this helper is injected via closure by React; to access outer setters we replace with window handlers in component scope
  // fallback no-op — real function defined in component scope
}

