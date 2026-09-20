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
  const [parentId, setParentId] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function load(){
    const res = await fetch('/api/admin/categories');
    const data = await res.json();
    setCats(data || []);
  }

  useEffect(()=>{ if(!initial || initial.length === 0) load(); },[]);

  const parentCategories = cats.filter(c => !c.parentId);
  const childMap = cats.reduce((acc, c) => {
    if (c.parentId) {
      acc[c.parentId] = acc[c.parentId] || [];
      acc[c.parentId].push(c);
    }
    return acc;
  }, {});

  async function handleAdd(e){
    e.preventDefault();
    const trimmedName = name?.trim();
    if(!trimmedName) return toast?.push?.({ message: 'Name required', type: 'error' });
    setBusy(true);
    const res = await fetch('/api/admin/categories', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: trimmedName, parentId: parentId || null }) });
    const body = await res.json();
    if(!res.ok) { toast?.push?.({ message: body?.error || 'Add failed', type: 'error' }); setBusy(false); return; }
    setName('');
    setParentId('');
    setCats(prev => [...prev, body]);
    toast?.push?.({ message: parentId ? 'Sub-category added' : 'Category added', type: 'success' });
    setBusy(false);
  }

  async function handleDelete(id){
    if(!confirm('Delete category?')) return;
    try{
      const res = await fetch('/api/admin/categories?id='+id, { method: 'DELETE', credentials: 'include' });
      if(!res.ok) throw new Error('Delete failed');
      setCats(prev => prev.filter(c=>c._id !== id && c.parentId !== id));
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
            <form onSubmit={handleAdd} className="flex flex-col md:flex-row gap-2">
              <select value={parentId} onChange={e=>setParentId(e.target.value)} className="p-2 border rounded min-w-[220px]">
                <option value="">Main category</option>
                {parentCategories.map(c => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
              <input value={name} onChange={e=>setName(e.target.value)} placeholder={parentId ? 'New sub-category name' : 'New category name'} className="p-2 border rounded flex-1" />
              <button className="px-3 py-1 bg-blue-600 text-white rounded" disabled={busy}>{busy? 'Adding...' : 'Add'}</button>
            </form>
          </div>
          <div className="bg-white p-4 rounded shadow">
            <ul className="space-y-2">
              {parentCategories.map(c => (
                <li key={c._id} className="border rounded p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold">{c.name}</div>
                    <button className="px-2 py-1 bg-red-600 text-white rounded text-sm" onClick={()=>handleDelete(c._id)}>Delete</button>
                  </div>
                  {(childMap[c._id] || []).length > 0 && (
                    <ul className="mt-2 ml-4 space-y-1">
                      {childMap[c._id].map(sub => (
                        <li key={sub._id} className="flex items-center justify-between border-l pl-3 py-1">
                          <span>{sub.name}</span>
                          <button className="px-2 py-1 bg-red-600 text-white rounded text-xs" onClick={()=>handleDelete(sub._id)}>Delete</button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
              {cats.filter(c => c.parentId).length === 0 && parentCategories.length === 0 && (
                <li className="text-gray-500 text-sm">No categories yet.</li>
              )}
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