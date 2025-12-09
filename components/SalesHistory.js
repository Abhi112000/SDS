import { useEffect, useState } from 'react';

export default function SalesHistory(){
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(()=>{ load(); }, [page]);

  async function load(){
    setLoading(true);
    try{
      const res = await fetch(`/api/admin/sales?page=${page}&limit=20`, { credentials: 'include' });
      const body = await res.json();
      setItems(body.items || []);
      setTotal(body.total || 0);
    }catch(e){ console.error('load sales failed', e); }
    setLoading(false);
  }

  return (
    <div className="bg-white p-4 rounded shadow">
      <h3 className="font-semibold mb-3">Sales history</h3>
      {loading ? <div>Loading…</div> : (
        <div>
          <div className="overflow-auto max-h-72 border rounded">
            <table className="w-full text-sm">
              <thead className="bg-gray-50"><tr><th className="p-2 border">When</th><th className="p-2 border">Item</th><th className="p-2 border">Qty</th><th className="p-2 border">Selling</th><th className="p-2 border">Cost</th><th className="p-2 border">Profit</th></tr></thead>
              <tbody>
                {items.map(s => (
                  <tr key={s._id || s.id}>
                    <td className="p-2 border">{new Date(s.timestamp).toLocaleString()}</td>
                    <td className="p-2 border">{s.name}</td>
                    <td className="p-2 border">{s.quantity}</td>
                    <td className="p-2 border">₹{(s.sellingPrice||0).toFixed(2)}</td>
                    <td className="p-2 border">₹{(s.costPrice||0).toFixed(2)}</td>
                    <td className="p-2 border">₹{(s.profit||0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-3">
            <div>Showing {items.length} of {total}</div>
            <div className="flex gap-2">
              <button onClick={()=>setPage(p=>Math.max(1,p-1))} className="px-2 py-1 border rounded">Prev</button>
              <button onClick={()=>setPage(p=>p+1)} className="px-2 py-1 border rounded">Next</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
