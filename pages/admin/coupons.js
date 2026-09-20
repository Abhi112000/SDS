import { getSession } from 'next-auth/react';
import useSWR from 'swr';
import { useState } from 'react';
import { useToast } from '@/components/Toast';
import AdminSidebar from '@/components/AdminSidebar';
import { authRedirect } from '@/lib/authRedirect';

const fetcher = url => fetch(url, { credentials: 'include' }).then(r=>r.json());

export default function AdminCoupons(){
  const { data, mutate } = useSWR('/api/coupons/admin', fetcher);
  const { data: usersData } = useSWR('/api/admin/users', fetcher);
  const [form, setForm] = useState({ code: '', type: 'percent', value: 10, public: true, maxUses: 1 });
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function create(){
    if(!form.code?.trim()) return toast?.push?.({ message: 'Coupon code is required', type: 'error' });
    if(!form.value || Number(form.value) <= 0) return toast?.push?.({ message: 'Coupon value must be greater than zero', type: 'error' });
    setBusy(true);
    try{
      const res = await fetch('/api/coupons/admin', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const payload = await res.json().catch(()=>({ error: 'Invalid response' }));
      if(!res.ok || !payload.ok) {
        return toast?.push?.({ message: 'Create failed: '+(payload.error || payload.message || 'unknown'), type: 'error' });
      }
      toast?.push?.({ message: `Coupon ${payload.coupon.code} created`, type: 'success' });
      setForm({ code: '', type: 'percent', value: 10, public: false, maxUses: 1 });
      mutate();
    }catch(e){
      toast?.push?.({ message: 'Network error: '+(e.message||String(e)), type: 'error' });
    }finally{
      setBusy(false);
    }
  }

  async function remove(id){
    if(!confirm('Delete coupon?')) return;
    try{
      const res = await fetch('/api/coupons/admin?id='+id,{ method: 'DELETE', credentials: 'include' });
      if(!res.ok) throw new Error('Delete failed');
      toast?.push?.({ message: 'Coupon removed', type: 'success' });
      mutate();
    }catch(e){
      toast?.push?.({ message: 'Delete failed: '+(e.message||'error'), type: 'error' });
    }
  }

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
          {!form.public && (
            <div className="mb-2">
              <label className="block text-sm font-medium mb-1">Assign to users</label>
              <select multiple value={form.allowedUserIds || []} onChange={e=>{
                const opts = Array.from(e.target.selectedOptions).map(o=>o.value);
                setForm(f=>({...f, allowedUserIds: opts}));
              }} className="w-full p-2 border h-36">
                {(usersData?.users || []).map(u=> (
                  <option key={u._id} value={u._id}>{u.name || u.email} • {u.email}</option>
                ))}
              </select>
              <div className="text-xs text-gray-500 mt-1">Select users who should see this private coupon.</div>
            </div>
          )}
          <input value={form.maxUses} onChange={e=>setForm({...form, maxUses: Number(e.target.value)})} placeholder="Max uses" className="w-full p-2 border mb-2" />
          <button onClick={create} disabled={busy} className="px-4 py-2 btn-primary rounded disabled:opacity-60">{busy ? 'Saving...' : 'Create'}</button>
        </div>
        <div>
          <div className="space-y-3">
            {!data?.coupons?.length && (
              <div className="text-sm text-gray-500">No coupons configured yet.</div>
            )}
            {data?.coupons?.map(c=> (
              <div key={c._id} className="bg-white p-3 rounded shadow flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="font-medium flex flex-wrap items-center gap-2">
                    <span>{c.code} {c.type==='percent' ? `${c.value}%` : `₹${c.value}`}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${c.public ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}`}>{c.public ? 'Public' : 'Private'}</span>
                    {!c.active && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">Inactive</span>}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">Uses: {c.usedCount || 0}/{c.maxUses || 1}</div>
                  {!c.public && c.allowedUserIds && c.allowedUserIds.length > 0 && (
                    <div className="text-xs text-gray-600 mt-1">Assigned to: {c.allowedUserIds.map(id=> (usersData?.users?.find(u=>u._id===id)?.email || id)).join(', ')}</div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={()=>remove(c._id)} className="px-3 py-1 bg-red-600 text-white rounded text-sm">Delete</button>
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
  if(!session || session.user?.role !== 'admin') return authRedirect(ctx);
  return { props: {} };
}