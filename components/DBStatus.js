import { useEffect, useState } from 'react';

export default function DBStatus(){
  const [status, setStatus] = useState('checking');

  useEffect(()=>{
    let mounted = true;
    fetch('/api/debug/db').then(res=>res.json()).then(j=>{
      if(!mounted) return;
      if(j.ok) setStatus('connected'); else setStatus('error');
    }).catch(()=>{
      if(!mounted) return;
      setStatus('error');
    });
    return ()=>{ mounted = false };
  },[]);

  return (
    <div className="w-full text-center py-2">
      {status === 'checking' && <div className="text-sm text-gray-500">Checking database connection...</div>}
  {status === 'connected' && <div className="text-sm text-mehroon">Database connected</div>}
  {status === 'error' && <div className="text-sm text-red-600">Database not connected (check server logs)</div>}
    </div>
  );
}
