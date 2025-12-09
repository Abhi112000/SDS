import { useState, useEffect, useRef } from 'react';

export default function DailySalesEntry({ onSuccess }){
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [selected, setSelected] = useState(null);
  const [sellingPrice, setSellingPrice] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  const searchTimer = useRef(null);

  useEffect(()=>{
  if(searchTimer.current) clearTimeout(searchTimer.current);
  if(!query){ setSuggestions([]); return; }
  setLoadingSuggestions(true);
  // faster debounce so suggestions appear as you type (match inventory behavior)
  searchTimer.current = setTimeout(async ()=>{
      try{
        const res = await fetch(`/api/admin/inventory?q=${encodeURIComponent(query)}&limit=10`, { credentials: 'include' });
        const body = await res.json();
        const items = body.items || [];
        setSuggestions(items);
      }catch(e){ console.error('search failed', e); setSuggestions([]); }
      setLoadingSuggestions(false);
  }, 150);
  }, [query]);

  useEffect(()=>{
    if(selected){
      setSellingPrice(selected.sellingPrice != null ? String(selected.sellingPrice) : '');
      setQuantity(1);
    }
  }, [selected]);

  function showToast(message, type='success'){
    setToast({ message, type });
    setTimeout(()=> setToast(null), 3500);
  }

  function computeProfit(){
    if(!selected) return 0;
    const cp = Number(selected.costPrice || 0);
    const sp = Number(sellingPrice || 0);
    const q = Number(quantity || 0);
    return (sp - cp) * q;
  }

  async function handleSubmit(e){
    e.preventDefault();
    if(!selected) return showToast('Select an item', 'error');
    const qty = parseInt(quantity, 10) || 0;
    if(qty <= 0) return showToast('Quantity must be > 0', 'error');
    if(qty > (selected.stock || 0)) return showToast('Quantity exceeds available stock', 'error');
    const sp = Number(sellingPrice || 0);
    if(isNaN(sp)) return showToast('Invalid selling price', 'error');

    setBusy(true);
    try{
      const res = await fetch('/api/admin/sales', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itemId: selected._id || selected.id, sellingPrice: sp, quantity: qty }) });
      const body = await res.json();
      if(!res.ok){
        if(res.status === 401) return showToast('Unauthorized — please sign in as an admin', 'error');
        return showToast(body && (body.error || body.message) ? (body.error || body.message) : 'Failed to record sale', 'error');
      }
      showToast('Sale recorded', 'success');
      // update local selected stock from response
      if(body.inventory){
        setSelected(s => ({ ...(s||{}), stock: body.inventory.stock }));
      }
      // dispatch local inventory update event so sidebar updates instantly
      try{
        if(typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('inventory.updated', { detail: { itemId: selected._id || selected.id, inventory: body.inventory } }));
      }catch(e){}
      setSellingPrice('');
      setQuantity(1);
      setQuery('');
      setSuggestions([]);
      if(typeof onSuccess === 'function') onSuccess(body);
    }catch(e){
      console.error('submit failed', e); showToast('Unable to submit', 'error');
    }
    setBusy(false);
  }

  return (
    <div className="bg-white p-4 rounded shadow">
      <h2 className="text-lg font-semibold mb-3">Daily Sales Entry</h2>
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label className="block text-sm font-medium">Search item</label>
          <div>
            <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Type name or SKU" className="w-full border p-2 rounded" />
          </div>
          {loadingSuggestions && <div className="text-sm text-gray-500 mt-1">Searching…</div>}
          {suggestions.length > 0 && (
            <ul className="border rounded mt-2 max-h-48 overflow-auto bg-white">
              {suggestions.map(it => (
                <li key={it._id || it.id} className="p-2 hover:bg-gray-50 cursor-pointer" onClick={()=>{ setSelected(it); setQuery(it.name + (it.sku ? (' ('+it.sku+')') : '')); setSuggestions([]); }}>
                  <div className="font-medium">{it.name} {it.sku ? <span className="text-xs text-gray-500"> — {it.sku}</span> : null}</div>
                  <div className="text-sm text-gray-600">Stock: {it.stock} • Cost: ₹{(it.costPrice||0).toFixed ? (it.costPrice).toFixed(2) : Number(it.costPrice||0).toFixed(2)}</div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {selected && (
          <div className="space-y-3">
            <div className="text-sm text-gray-700"><strong>Selected:</strong> {selected.name} {selected.sku ? `(${selected.sku})` : ''}</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm">Cost price</label>
                <div className="p-2 border rounded">₹{Number(selected.costPrice||0).toFixed(2)}</div>
              </div>
              <div>
                <label className="block text-sm">Available stock</label>
                <div className={`p-2 border rounded ${selected.stock <= (selected.minStockLevel||0) ? 'text-red-600' : ''}`}>{selected.stock}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm">Selling price</label>
                <input value={sellingPrice} onChange={e=>setSellingPrice(e.target.value)} className="w-full p-2 border rounded" />
              </div>
              <div>
                <label className="block text-sm">Quantity</label>
                <input type="number" value={quantity} onChange={e=>setQuantity(e.target.value)} className="w-full p-2 border rounded" />
              </div>
            </div>

            <div className="text-sm">Profit: <span className="font-semibold">₹{computeProfit().toFixed(2)}</span></div>

            <div className="flex items-center gap-3">
              <button disabled={busy} className="px-4 py-2 bg-blue-600 text-white rounded">{busy ? 'Saving…' : 'Record sale'}</button>
              <button type="button" onClick={()=>{ setSelected(null); setQuery(''); setSuggestions([]); setSellingPrice(''); setQuantity(1); }} className="px-3 py-2 border rounded">Clear</button>
            </div>
          </div>
        )}
      </form>

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 max-w-sm ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'} px-4 py-3 rounded-lg shadow-lg`} role="status" aria-live="polite">
          <div className="font-medium">{toast.type === 'error' ? 'Error' : 'Success'}</div>
          <div className="text-sm mt-1">{toast.message}</div>
        </div>
      )}
    </div>
  );
}
