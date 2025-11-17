import { getSession } from 'next-auth/react';
import dbConnect from '@/lib/mongodb';
import Product from '../../models/Product';
import { useEffect, useState } from 'react';

export default function AdminProducts({ initial }){
  const [products, setProducts] = useState(initial || []);
  const [form, setForm] = useState({ title: '', price: '', sku: '', category: '', stock: 9999, description: '', images: [] });
  const [editingId, setEditingId] = useState(null);

  async function load(){
  const res = await fetch('/api/products', { credentials: 'include' });
    const data = await res.json();
    setProducts(data);
  }

  useEffect(()=>{ load() },[]);

  async function uploadImage(file){
    // Cloudinary unsigned upload if env var provided
    if(!process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || !process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME){
      alert('Cloudinary not configured.');
      return null;
    }
    const fd = new FormData();
    fd.append('file', file);
    fd.append('upload_preset', process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET);
    const url = `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/upload`;
    const r = await fetch(url, { method: 'POST', body: fd });
    const j = await r.json();
    return j.secure_url;
  }

  async function handleCreate(e){
    e.preventDefault();
  const payload = { ...form, price: Number(form.price), originalPrice: form.originalPrice ? Number(form.originalPrice) : undefined, onSale: !!form.onSale, stock: Number(form.stock) };
  const url = editingId ? `/api/products?id=${editingId}` : '/api/products';
  const method = editingId ? 'PUT' : 'POST';
  const res = await fetch(url, { method, credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if(!res.ok) return alert('Failed');
    setForm({ title: '', price: '', sku: '', category: '', stock: 9999, description: '', images: [] });
  setEditingId(null);
    load();
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Admin: Products</h1>
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <form onSubmit={handleCreate} className="bg-white p-4 rounded shadow">
            <input value={form.title} onChange={e=>setForm({...form, title: e.target.value})} placeholder="Title" className="w-full p-2 border mb-2" />
            <input value={form.price} onChange={e=>setForm({...form, price: e.target.value})} placeholder="Price" className="w-full p-2 border mb-2" />
            <input value={form.originalPrice || ''} onChange={e=>setForm({...form, originalPrice: e.target.value})} placeholder="Original price (optional)" className="w-full p-2 border mb-2" />
            <div className="mb-2"><label><input type="checkbox" checked={!!form.onSale} onChange={e=>setForm({...form, onSale: e.target.checked})} /> On sale</label></div>
            <input value={form.sku} onChange={e=>setForm({...form, sku: e.target.value})} placeholder="SKU" className="w-full p-2 border mb-2" />
            <input value={form.category} onChange={e=>setForm({...form, category: e.target.value})} placeholder="Category" className="w-full p-2 border mb-2" />
            <input value={form.stock} onChange={e=>setForm({...form, stock: e.target.value})} placeholder="Stock" className="w-full p-2 border mb-2" />
            <textarea value={form.description} onChange={e=>setForm({...form, description: e.target.value})} placeholder="Description" className="w-full p-2 border mb-2" />
            <div className="mb-2">
              <label className="block mb-1">Images</label>
              <input type="file" onChange={async e=>{
                const file = e.target.files[0];
                const url = await uploadImage(file);
                if(url) setForm(f=>({ ...f, images: [...f.images, url] }));
              }} />
              <div className="flex gap-2 mt-2">
                {form.images.map((u,i)=> <img key={i} src={u} className="w-16 h-16 object-cover rounded" />)}
              </div>
            </div>
            <div className="mb-2"><label><input type="checkbox" checked={!!form.featured} onChange={e=>setForm({...form, featured: e.target.checked})} /> Featured</label></div>
            <button className="px-4 py-2 btn-primary rounded">Create</button>
          </form>
        </div>
        <div>
          <div className="space-y-3">
            {products.map(p=> (
              <div key={p._id} className="bg-white p-3 rounded shadow flex justify-between items-center">
                <div>
                      <div className="font-medium">{p.title} {p.featured? <span className="ml-2 text-xs bg-yellow-100 px-2 py-0.5 rounded">Featured</span>:null}</div>
                      <div className="text-sm text-gray-500">₹{p.price} • {p.category}</div>
                </div>
                <div>
                      <button onClick={()=>{ setEditingId(p._id); setForm({ title: p.title || '', price: p.price || '', sku: p.sku || '', category: p.category || '', stock: p.stock || 0, description: p.description || '', images: p.images || [] }) }} className="px-2 py-1 mr-2">Edit</button>
                      <button className="px-2 py-1" style={{ background: '#b91c1c', color: 'white', padding: '6px 10px', borderRadius: 6 }} onClick={async ()=>{ if(confirm('Delete?')){ await fetch('/api/products?id='+p._id,{ method: 'DELETE', credentials: 'include' }); load(); }}}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export async function getServerSideProps(ctx){
  const session = await getSession(ctx);
  if(!session || session.user.role !== 'admin') return { redirect: { destination: '/login', permanent: false } };
  await dbConnect();
  const initial = await Product.find({}).lean();
  return { props: { initial: JSON.parse(JSON.stringify(initial)) } };
}
