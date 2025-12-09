import { getSession } from 'next-auth/react';
import useSWR from 'swr';
import { useState } from 'react';
import { useToast } from '@/components/Toast';
import AdminSidebar from '@/components/AdminSidebar';

const fetcher = url => fetch(url, { credentials: 'include' }).then(r=>r.json());

export default function AdminCoupons(){
  const { data, mutate } = useSWR('/api/coupons/admin', fetcher);
  const [form, setForm] = useState({ code: '', type: 'percent', value: 10, public: false, maxUses: 1 });
  const toast = useToast();

  async function create(){
  try{
    const res = await fetch('/api/coupons/admin', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if(!res.ok){
      let errText = 'Failed';
      try{ const j = await res.json(); if(j && j.error) errText = j.error; else if(j && j.message) errText = j.message; else if(j && j.detail) errText = JSON.stringify(j); }catch(e){}
      return toast?.push?.({ message: 'Create failed: '+errText, type: 'error' });
    }
    
    const payload = await res.json();
    if(!payload.ok) return toast?.push?.({ message: 'Create failed: '+(payload.error||'unknown'), type: 'error' });
  }catch(e){
    return toast?.push?.({ message: 'Network error: '+(e.message||String(e)), type: 'error' });
  }
    setForm({ code: '', type: 'percent', value: 10, public: false, maxUses: 1 });
    mutate();
  }

  async function remove(id){ if(!confirm('Delete coupon?')) return; await fetch('/api/coupons/admin?id='+id,{ method: 'DELETE', credentials: 'include' }); mutate(); }

  return (
    <div className="p-6">
      <div className="grid md:grid-cols-4 gap-6">
        <AdminSidebar />
        <main className="md:col-span-3">
          <h1 className="text-2xl font-bold mb-4">Admin: Coupons</h1>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white p-4 rounded shadow">
          <input value={form.code} onChange={e=>setForm({...form, code: e.target.value.toUpperCase()})} placeholder="Code" className="w-full p-2 border mb-2" />
          <select value={form.type} onChange={e=>setForm({...form, type: e.target.value})} className="w-full p-2 border mb-2">
            <option value="percent">Percent</option>
            <option value="fixed">Fixed</option>
          </select>
          <input value={form.value} onChange={e=>setForm({...form, value: Number(e.target.value)})} placeholder="Value" className="w-full p-2 border mb-2" />
          <div className="flex gap-2 items-center mb-2"><label><input type="checkbox" checked={form.public} onChange={e=>setForm({...form, public: e.target.checked})} /> Public</label></div>
          <input value={form.maxUses} onChange={e=>setForm({...form, maxUses: Number(e.target.value)})} placeholder="Max uses" className="w-full p-2 border mb-2" />
          <button onClick={create} className="px-4 py-2 btn-primary rounded">Create</button>
        </div>
        <div>
          <div className="space-y-3">
            {data?.coupons?.map(c=> (
              <div key={c._id} className="bg-white p-3 rounded shadow flex justify-between items-center">
                <div>
                  <div className="font-medium flex items-center gap-3">
                    <span>{c.code} {c.type==='percent' ? `${c.value}%` : `₹${c.value}`}</span>
                    {c.public ? <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">Public</span> : <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">Private</span>}
                  </div>
                  <div className="text-sm text-gray-500">Uses: {c.usedCount || 0}/{c.maxUses || 1}</div>
                </div>
                <div>
                  <button onClick={()=>remove(c._id)} className="px-2 py-1" style={{ background: '#b91c1c', color: 'white', padding: '6px 10px', borderRadius: 6 }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export async function getServerSideProps(ctx){
  const session = await getSession(ctx);
  if(!session || session.user.role !== 'admin') return { redirect: { destination: '/login', permanent: false } };
  return { props: {} };
}
