import { useState } from 'react';

export default function DailySalesBatch({ onResult }){
  const [csvText, setCsvText] = useState('');
  const [processing, setProcessing] = useState(false);
  const [preview, setPreview] = useState([]);
  const [toast, setToast] = useState(null);

  function showToast(msg, type='success'){ setToast({ msg, type }); setTimeout(()=>setToast(null),3500); }

  function parseCSV(text){
    const lines = text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
    if(lines.length === 0) return [];
    const header = lines[0].split(',').map(h => h.trim().toLowerCase());
    const rows = [];
    for(let i=1;i<lines.length;i++){
      const cols = lines[i].split(',').map(c => c.trim());
      const obj = {};
      for(let j=0;j<header.length;j++) obj[header[j]] = cols[j] || '';
      rows.push(obj);
    }
    return rows;
  }

  function handlePreview(){
    const rows = parseCSV(csvText);
    setPreview(rows);
    if(rows.length) showToast(`Parsed ${rows.length} rows`, 'success');
  }

  async function handleSubmit(){
    const rows = parseCSV(csvText);
    if(!rows.length) return showToast('No rows to submit', 'error');
    // Expect columns: itemId (or sku), sellingPrice, quantity, note(optional)
    setProcessing(true);
    try{
      // Map rows to normalized objects. If row has sku but no itemId, API will resolve later (not implemented), so prefer itemId.
      const items = rows.map(r => ({ itemId: r.itemid || r.itemId || r.id || null, sku: r.sku || null, sellingPrice: Number(r.sellingprice || r.sellingPrice || r.price || 0), quantity: Number(r.quantity || r.qty || 0), note: r.note || '' }));
      const res = await fetch('/api/admin/sales/batch', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items }) });
      const body = await res.json();
      if(!res.ok) { showToast(body && body.error ? body.error : 'Batch failed', 'error'); setProcessing(false); return; }
      showToast('Batch processed', 'success');
      // dispatch local inventory.updated events for each successful row so sidebar updates instantly
      try{
        if(Array.isArray(body.results)){
          body.results.forEach(r => {
            if(r && r.ok && typeof window !== 'undefined'){
              try{ window.dispatchEvent(new CustomEvent('inventory.updated', { detail: { itemId: r.sale && r.sale.itemId, inventory: r.inventory } })); }catch(e){}
            }
          });
        }
      }catch(e){}
      if(typeof onResult === 'function') onResult(body);
    }catch(e){ console.error(e); showToast('Unable to process batch', 'error'); }
    setProcessing(false);
  }

  return (
    <div className="bg-white p-4 rounded shadow">
      <h3 className="font-semibold mb-3">Batch sales (CSV)</h3>
      <p className="text-sm text-gray-600 mb-2">CSV header columns: <code>itemId</code> or <code>sku</code>, <code>sellingPrice</code>, <code>quantity</code>, <code>note</code> (optional)</p>
      <textarea value={csvText} onChange={e=>setCsvText(e.target.value)} rows={8} className="w-full border p-2 rounded mb-2" placeholder={`itemId,sellingPrice,quantity,note\n6123...,120,2,Sale note`}></textarea>
      <div className="flex gap-2">
        <button onClick={handlePreview} className="px-3 py-1 border rounded">Preview</button>
        <button onClick={handleSubmit} disabled={processing} className="px-3 py-1 bg-blue-600 text-white rounded">{processing ? 'Processing…' : 'Submit Batch'}</button>
      </div>

      {preview.length > 0 && (
        <div className="mt-4">
          <h4 className="font-medium">Preview ({preview.length})</h4>
          <div className="overflow-auto max-h-40 border rounded mt-2 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50"><tr>{Object.keys(preview[0]).map(k=> <th key={k} className="p-2 border">{k}</th>)}</tr></thead>
              <tbody>{preview.map((r,i)=> <tr key={i}>{Object.keys(preview[0]).map(k=> <td key={k} className="p-2 border">{r[k]}</td>)}</tr>)}</tbody>
            </table>
          </div>
        </div>
      )}

      {toast && <div className={`mt-3 p-2 rounded ${toast.type==='error' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>{toast.msg}</div>}
    </div>
  );
}
