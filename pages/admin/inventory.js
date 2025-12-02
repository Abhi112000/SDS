import { useEffect, useState } from 'react';
import { getSession } from 'next-auth/react';
import dbConnect from '@/lib/mongodb';
import Product from '@/models/Product';
import { useToast } from '@/components/Toast';

function formatCurrency(v){ return '₹' + (Number(v||0)).toFixed(2); }

export default function AdminInventory({ initial = [] }){
  const [items, setItems] = useState(initial || []);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [categories, setCategories] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({});
  const toast = useToast();

  async function load(){
    const res = await fetch('/api/products', { credentials: 'include' });
    const data = await res.json();
    setItems(data.products || []);
  }

  async function loadCategories(){
    try{ const r = await fetch('/api/admin/categories'); const c = await r.json(); setCategories(c || []); }catch(e){}
  }

  useEffect(()=>{ load(); loadCategories(); },[]);

  function filtered(){
    return (items || []).filter(it => {
      if(categoryFilter && it.category !== categoryFilter) return false;
      if(!query) return true;
      const q = query.toLowerCase();
      return (it.title||'').toString().toLowerCase().includes(q) || (it.sku||'').toString().toLowerCase().includes(q);
    });
  }

  function exportCSV(){
    const rows = [['Title','SKU','Category','Selling Price','Actual Price','Stock','Profit Per Unit','Total Potential Profit']];
    for(const it of filtered()){
      const selling = Number(it.price||0);
      const actual = Number(it.originalPrice||0);
      const profitPer = selling - actual;
      const totalPotential = profitPer * Number(it.stock || 0);
      rows.push([it.title||'', it.sku||'', it.category||'', selling, actual, Number(it.stock||0), profitPer, totalPotential]);
    }
    const csv = rows.map(r => r.map(c => '"'+String(c).replace(/"/g,'""')+'"').join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'inventory-' + new Date().toISOString().slice(0,10) + '.csv';
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  function openPrint(){
    const rows = filtered().map(it => {
      const selling = Number(it.price||0);
      const actual = Number(it.originalPrice||0);
      const profitPer = selling - actual;
      const totalPotential = profitPer * Number(it.stock || 0);
      return `<tr><td>${it.title||''}</td><td>${it.sku||''}</td><td>${it.category||''}</td><td style="text-align:right">${selling.toFixed(2)}</td><td style="text-align:right">${actual.toFixed(2)}</td><td style="text-align:right">${Number(it.stock||0)}</td><td style="text-align:right">${profitPer.toFixed(2)}</td><td style="text-align:right">${totalPotential.toFixed(2)}</td></tr>`;
    }).join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Inventory</title><style>table{width:100%;border-collapse:collapse}td,th{border:1px solid #ddd;padding:6px}</style></head><body><h2>Inventory</h2><table><thead><tr><th>Title</th><th>SKU</th><th>Category</th><th>Price</th><th>Actual</th><th>Stock</th><th>Profit/unit</th><th>Total potential</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
    const w = window.open('about:blank','inventory'); if(!w) { toast?.push?.({ message: 'Popup blocked', type: 'error' }); return; }
    w.document.write(html); w.document.close(); setTimeout(()=>{ try{ w.focus(); w.print(); }catch(e){} },300);
  }

  async function startEdit(it){ setEditingId(it._id); setEditValues({ price: it.price||0, originalPrice: it.originalPrice||0, stock: it.stock||0, title: it.title||'', sku: it.sku||'', category: it.category||'' }); }

  async function saveEdit(id){
    try{
      const payload = { price: Number(editValues.price||0), originalPrice: Number(editValues.originalPrice||0), stock: Number(editValues.stock||0), title: editValues.title, sku: editValues.sku, category: editValues.category };
      const r = await fetch('/api/products?id=' + id, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if(!r.ok) throw new Error('Save failed');
      toast?.push?.({ message: 'Saved', type: 'success' });
      setEditingId(null); setEditValues({}); load();
    }catch(e){ toast?.push?.({ message: 'Save failed: ' + (e.message||''), type: 'error' }); }
  }

  async function handleDelete(id){ if(!confirm('Delete item?')) return; try{ const r = await fetch('/api/products?id='+id, { method: 'DELETE', credentials: 'include' }); if(!r.ok) throw new Error('Delete failed'); toast?.push?.({ message: 'Deleted', type: 'success' }); load(); }catch(e){ toast?.push?.({ message: 'Delete failed: ' + (e.message||''), type: 'error' }); } }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Inventory / Stock Management</h1>
        <div className="space-x-2">
          <a href="/admin" className="px-3 py-1 bg-gray-100 rounded">Back</a>
          <button onClick={exportCSV} className="px-3 py-1 bg-gray-100 rounded">Download CSV</button>
          <button onClick={openPrint} className="px-3 py-1 bg-gray-100 rounded">Print / PDF</button>
        </div>
      </div>

      <div className="bg-white p-4 rounded shadow mb-4">
        <div className="flex gap-2 items-center">
          <input placeholder="Search by title or SKU" value={query} onChange={e=>setQuery(e.target.value)} className="p-2 border rounded flex-1" />
          <select value={categoryFilter} onChange={e=>setCategoryFilter(e.target.value)} className="p-2 border rounded">
            <option value="">All categories</option>
            {categories.map(c => <option key={c._id} value={c.name}>{c.name}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white p-4 rounded shadow overflow-auto">
        <table className="w-full text-sm table-auto">
          <thead><tr className="bg-gray-100"><th className="p-2 text-left">Title</th><th className="p-2">SKU</th><th className="p-2">Category</th><th className="p-2 text-right">Price</th><th className="p-2 text-right">Actual</th><th className="p-2 text-right">Stock</th><th className="p-2 text-right">Profit/unit</th><th className="p-2 text-right">Total Potential</th><th className="p-2">Actions</th></tr></thead>
          <tbody>
            {filtered().map(it => {
              const selling = Number(it.price||0);
              const actual = Number(it.originalPrice||0);
              const profitPer = selling - actual;
              const totalPotential = profitPer * Number(it.stock || 0);
              return (
                <tr key={it._id} className="border-t">
                  <td className="p-2">{it.title}</td>
                  <td className="p-2">{it.sku}</td>
                  <td className="p-2">{it.category}</td>
                  <td className="p-2 text-right">{formatCurrency(selling)}</td>
                  <td className="p-2 text-right">{formatCurrency(actual)}</td>
                  <td className="p-2 text-right">{it.stock||0}</td>
                  <td className="p-2 text-right">{profitPer.toFixed(2)}</td>
                  <td className="p-2 text-right">{totalPotential.toFixed(2)}</td>
                  <td className="p-2">
                    <div className="flex gap-2">
                      <button className="px-2 py-1 bg-blue-600 text-white rounded" onClick={()=>startEdit(it)}>Update</button>
                      <button className="px-2 py-1 bg-red-600 text-white rounded" onClick={()=>handleDelete(it._id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Edit modal */}
      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white p-6 rounded shadow max-w-2xl w-full">
            <h3 className="text-lg font-semibold mb-3">Edit Item</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm">Title</label>
                <input value={editValues.title} onChange={e=>setEditValues(prev=>({...prev,title:e.target.value}))} className="p-2 border rounded w-full" />
              </div>
              <div>
                <label className="block text-sm">SKU</label>
                <input value={editValues.sku} onChange={e=>setEditValues(prev=>({...prev,sku:e.target.value}))} className="p-2 border rounded w-full" />
              </div>
              <div>
                <label className="block text-sm">Category</label>
                <select value={editValues.category} onChange={e=>setEditValues(prev=>({...prev,category:e.target.value}))} className="p-2 border rounded w-full">
                  <option value="">Select category</option>
                  {categories.map(c => <option key={c._id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm">Stock</label>
                <input type="number" value={editValues.stock} onChange={e=>setEditValues(prev=>({...prev,stock:e.target.value}))} className="p-2 border rounded w-full" />
              </div>
              <div>
                <label className="block text-sm">Selling Price</label>
                <input type="number" value={editValues.price} onChange={e=>setEditValues(prev=>({...prev,price:e.target.value}))} className="p-2 border rounded w-full" />
              </div>
              <div>
                <label className="block text-sm">Actual / Cost Price</label>
                <input type="number" value={editValues.originalPrice} onChange={e=>setEditValues(prev=>({...prev,originalPrice:e.target.value}))} className="p-2 border rounded w-full" />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="px-4 py-2 bg-gray-100 rounded" onClick={()=>{ setEditingId(null); setEditValues({}); }}>Cancel</button>
              <button className="px-4 py-2 bg-red-600 text-white rounded" onClick={()=>handleDelete(editingId)}>Delete</button>
              <button className="px-4 py-2 bg-green-600 text-white rounded" onClick={()=>saveEdit(editingId)}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export async function getServerSideProps(ctx){
  const session = await getSession(ctx);
  if(!session || session.user.role !== 'admin') return { redirect: { destination: '/login', permanent: false } };
  await dbConnect();
  const items = await Product.find({}).lean();
  return { props: { initial: JSON.parse(JSON.stringify(items || [])) } };
}
