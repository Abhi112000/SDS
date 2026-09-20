import { useState, useEffect } from 'react';

export default function DeliveryAvailability(){
  const [pincode, setPincode] = useState('');
  const [locality, setLocality] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [suggestions, setSuggestions] = useState([]);

  useEffect(()=>{ // fetch locality suggestions
    let mounted = true;
    fetch('/api/delivery/localities?page=1&pageSize=100').then(r=>r.json()).then(j=>{
      if(!mounted) return;
      setSuggestions((j && j.items) ? j.items.map(it=>it.locality).filter(Boolean) : []);
    }).catch(()=>{});
    return ()=>{ mounted = false; };
  },[]);

  async function check(){
    setLoading(true); setResult(null);
    try{
      const res = await fetch('/api/delivery/verify-pincode', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ pincode }) });
      const j = await res.json();
      if(res.ok && j){
        setResult({ ok: !!j.available, message: j.available ? '✅ Delivery Available' : '❌ Sorry, we currently do not deliver to your locality.', data: j });
      } else {
        setResult({ ok: false, message: j.error || '❌ Delivery not available' });
      }
    }catch(e){ setResult({ ok: false, message: '❌ Unable to check delivery' }); }
    setLoading(false);
  }

  return (
    <div id="delivery-check" className="bg-white p-4 rounded shadow">
      <h3 className="text-lg font-medium mb-2">Check Delivery Availability</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
        <div>
          <label className="block text-sm">Pincode</label>
          <input value={pincode} onChange={e=>setPincode(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="e.g. 201002" className="w-full p-2 border rounded" />
        </div>
        <div>
          <label className="block text-sm">Locality (optional)</label>
          <input list="locality-suggestions" value={locality} onChange={e=>setLocality(e.target.value)} placeholder="Locality name" className="w-full p-2 border rounded" />
          <datalist id="locality-suggestions">
            {suggestions.map(s=> <option key={s} value={s} />)}
          </datalist>
        </div>
        <div>
          <button onClick={check} disabled={loading || !pincode} className="px-4 py-2 bg-indigo-600 text-white rounded">{loading ? 'Checking…' : 'Check Availability'}</button>
        </div>
      </div>
      {result && (
        <div className={`mt-3 p-3 rounded ${result.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`} aria-live="polite">{result.message}{result.data && result.data.estimatedCharge ? ` • Est. charge: ₹${result.data.estimatedCharge}` : ''}</div>
      )}
    </div>
  );
}
