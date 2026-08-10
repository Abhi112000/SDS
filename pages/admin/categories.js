import { useEffect, useState } from 'react';
import { getSession } from 'next-auth/react';
import dbConnect from '@/lib/mongodb';
import Category from '@/models/Category';
import { useToast } from '@/components/Toast';
import AdminSidebar from '@/components/AdminSidebar';
import { authRedirect } from '@/lib/authRedirect';

export default function AdminCategories({ initial = [] }){
  const [cats, setCats] = useState(initial || []);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function load(){
    const res = await fetch('/api/admin/categories');
    const data = await res.json();
    setCats(data || []);
  }

  useEffect(()=>{ if(!initial || initial.length === 0) load(); },[]);

  async function handleAdd(e){
    e.preventDefault();
    if(!name?.trim()) return toast?.push?.({ message: 'Name required', type: 'error' });
    setBusy(true);
    const res = await fetch('/api/admin/categories', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim() }) });
    const body = await res.json();
    if(!res.ok) { toast?.push?.({ message: body?.error || 'Add failed', type: 'error' }); setBusy(false); return; }
    setName('');
    setCats(prev => [body, ...prev]);
    toast?.push?.({ message: 'Category added', type: 'success' });
    setBusy(false);
  }

  async function handleDelete(id){
    if(!confirm('Delete category?')) return;
    try{
      const res = await fetch('/api/admin/categories?id='+id, { method: 'DELETE', credentials: 'include' });
      if(!res.ok) throw new Error('Delete failed');
      setCats(prev => prev.filter(c=>c._id !== id));
      toast?.push?.({ message: 'Deleted', type: 'success' });
    }catch(e){ toast?.push?.({ message: 'Delete failed: ' + (e.message||''), type: 'error' }); }
  }

  return (
    <div className="p-6">
      <div className="grid md:grid-cols-4 gap-6">
        <AdminSidebar />
        <main className="md:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold">Manage Categories</h1>
            <a href="/admin" className="px-3 py-1 bg-gray-100 rounded">Back</a>
          </div>
          <div className="bg-white p-4 rounded shadow mb-4">
            <form onSubmit={handleAdd} className="flex gap-2">
              <input value={name} onChange={e=>setName(e.target.value)} placeholder="New category name" className="p-2 border rounded flex-1" />
              <button className="px-3 py-1 bg-blue-600 text-white rounded" disabled={busy}>{busy? 'Adding...' : 'Add'}</button>
            </form>
          </div>
          <div className="bg-white p-4 rounded shadow">
            <ul>
              {cats.map(c => (
                <li key={c._id} className="py-2 border-b flex items-center justify-between">
                  <div>{c.name}</div>
                  <div><button className="px-2 py-1 bg-red-600 text-white rounded" onClick={()=>handleDelete(c._id)}>Delete</button></div>
                </li>
              ))}
            </ul>
          </div>
        </main>
      </div>
    </div>
  );
}

export async function getServerSideProps(ctx){
  const session = await getSession(ctx);
  if(!session || session.user?.role !== 'admin') return authRedirect(ctx);
  await dbConnect();
  const initial = await Category.find({}).sort({ name: 1 }).lean();
  return { props: { initial: JSON.parse(JSON.stringify(initial || [])) } };
}