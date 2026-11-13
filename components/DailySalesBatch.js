import { useState } from 'react';

export default function DailySalesBatch({ onResult }){
  const [csvText, setCsvText] = useState('');
  const [processing, setProcessing] = useState(false);
  const [preview, setPreview] = useState([]);
  const [toast, setToast] = useState(null);

  function showToast(msg, type='success'){ setToast({ msg, type }); setTimeout(()=>setToast(null),3500); }

  function parseCSV(text){
    const records = [];
    let row = [];
    let field = '';
    let quoted = false;
    for(let i = 0; i < text.length; i += 1){
      const char = text[i];
      if(char === '"'){
        if(quoted && text[i + 1] === '"'){ field += '"'; i += 1; }
        else quoted = !quoted;
      }else if(char === ',' && !quoted){
        row.push(field.trim());
        field = '';
      }else if((char === '\n' || char === '\r') && !quoted){
        if(char === '\r' && text[i + 1] === '\n') i += 1;
        row.push(field.trim());
        if(row.some(value => value !== '')) records.push(row);
        row = [];
        field = '';
      }else{
        field += char;
      }
    }
    if(quoted) throw new Error('CSV contains an unclosed quoted field');
    row.push(field.trim());
    if(row.some(value => value !== '')) records.push(row);
    if(records.length < 2) return [];
    const header = records[0].map(h => h.trim().toLowerCase());
    const rows = [];
    for(let i=1;i<records.length;i++){
      const cols = records[i];
      const obj = {};
      for(let j=0;j<header.length;j++) obj[header[j]] = cols[j] || '';
      rows.push(obj);
    }
    return rows;
  }

  function handlePreview(){
    try{
      const rows = parseCSV(csvText);
      setPreview(rows);
      if(rows.length) showToast(`Parsed ${rows.length} rows`, 'success');
      else showToast('No data rows found', 'error');
    }catch(error){ showToast(error.message, 'error'); }
  }

  async function handleSubmit(){
    let rows;
    try{ rows = parseCSV(csvText); }
    catch(error){ return showToast(error.message, 'error'); }
    if(!rows.length) return showToast('No rows to submit', 'error');
    // Expect columns: itemId (or sku), sellingPrice, quantity, note(optional)
    setProcessing(true);
    try{
      const items = rows.map(r => ({ itemId: r.itemid || r.id || null, sku: r.sku || null, sellingPrice: Number(r.sellingprice || r.price || 0), quantity: Number(r.quantity || r.qty || 0), note: r.note || '' }));
      const res = await fetch('/api/admin/sales/batch', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items }) });
      const body = await res.json();
      if(!res.ok) { showToast(body && body.error ? body.error : 'Batch failed', 'error'); setProcessing(false); return; }
      showToast(`Processed ${body.succeeded || 0} rows; ${body.failed || 0} failed`, body.failed ? 'error' : 'success');
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
      setPreview(rows);
      setResults(body.results || []);
    }catch(e){ console.error(e); showToast('Unable to process batch', 'error'); }
    setProcessing(false);
  }

  const [results, setResults] = useState([]);

  return (
    <div className="bg-white p-4 rounded shadow">
      <h3 className="font-semibold mb-3">Batch sales (CSV)</h3>
      <p className="text-sm text-gray-600 mb-2">CSV header columns: <code>itemId</code> or <code>sku</code>, <code>sellingPrice</code>, <code>quantity</code>, <code>note</code> (optional). Quoted commas are supported.</p>
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
      {results.length > 0 && (
        <div className="mt-4">
          <h4 className="font-medium">Row results</h4>
          <ul className="mt-2 space-y-1 text-sm">
            {results.map((result, index) => <li key={index} className={result.ok ? 'text-green-700' : 'text-red-700'}>Row {result.row || index + 1}: {result.ok ? 'Sale recorded' : result.error}</li>)}
          </ul>
        </div>
      )}

      {toast && <div className={`mt-3 p-2 rounded ${toast.type==='error' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>{toast.msg}</div>}
    </div>
  );
}
