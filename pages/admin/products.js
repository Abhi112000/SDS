import { getSession } from 'next-auth/react';
import dbConnect from '@/lib/mongodb';
import Product from '../../models/Product';
import { useEffect, useState } from 'react';
import { useToast } from '@/components/Toast';

export default function AdminProducts({ initial }){
  const [products, setProducts] = useState(initial || []);
  const toast = useToast();
  const [form, setForm] = useState({ title: '', price: '', sku: '', category: '', stock: 9999, description: '', images: [] });
  const [editingId, setEditingId] = useState(null);

  async function load(){
  const res = await fetch('/api/products', { credentials: 'include' });
    const data = await res.json();
    setProducts(data);
  }

  useEffect(()=>{ load() },[]);

  async function uploadImage(file){
    // Server-side upload proxy: send a dataUrl to /api/admin/upload-image
    try{
      // If a File is provided, convert to data URL
      let dataUrl;
      if(typeof file === 'string' && file.startsWith('data:')) dataUrl = file;
      else {
        dataUrl = await new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(r.result);
          r.onerror = rej;
          r.readAsDataURL(file);
        });
      }
      const r = await fetch('/api/admin/upload-image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dataUrl }) });
      const j = await r.json();
      if(!r.ok || !j?.url){
        console.error('server upload failed', j);
        toast?.push?.({ message: 'Upload failed: ' + (j?.error?.message || j?.error || JSON.stringify(j)), type: 'error' });
        return null;
      }
      return j.url;
    }catch(e){
      console.error('uploadImage error', e);
      toast?.push?.({ message: 'Upload error: ' + (e?.message||String(e)), type: 'error' });
      return null;
    }
  }

  // client-side resize helper — returns a Blob
  async function resizeImage(file, maxWidth = 1200, maxHeight = 1200, quality = 0.8){
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        let { width, height } = img;
        let targetW = width;
        let targetH = height;
        if(width > maxWidth || height > maxHeight){
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          targetW = Math.round(width * ratio);
          targetH = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.drawImage(img, 0, 0, targetW, targetH);
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(url);
          if(!blob) return reject(new Error('Canvas toBlob returned null'));
          resolve(blob);
        }, 'image/jpeg', quality);
      };
      img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
      img.src = url;
    });
  }

  async function handleCreate(e){
    e.preventDefault();
  const payload = { ...form, price: Number(form.price), originalPrice: form.originalPrice ? Number(form.originalPrice) : undefined, onSale: !!form.onSale, stock: Number(form.stock) };
  const url = editingId ? `/api/products?id=${editingId}` : '/api/products';
  const method = editingId ? 'PUT' : 'POST';
  const res = await fetch(url, { method, credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  if(!res.ok) return toast?.push?.({ message: 'Failed', type: 'error' });
    setForm({ title: '', price: '', sku: '', category: '', stock: 9999, description: '', images: [] });
  setEditingId(null);
    load();
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Admin: Products</h1>
        <a href="/admin" className="px-3 py-1 bg-gray-100 rounded">Back to dashboard</a>
      </div>
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
                <input type="file" accept="image/*" multiple onChange={async e=>{
                  const files = Array.from(e.target.files || []);
                  if(files.length === 0) return;
                  const added = [];
                  for(const file of files){
                    try{
                      const resizedBlob = await resizeImage(file, 1200, 1200, 0.8);
                      // send resized image to server-side upload proxy which will forward to Cloudinary
                      const f = new File([resizedBlob], file.name || 'upload.jpg', { type: resizedBlob.type });
                      const url = await uploadImage(f);
                      if(url) added.push(url);
                      else {
                        // fallback: keep inline data URL so the admin can still see the image
                        const reader = new FileReader();
                        const dataUrl = await new Promise((res,rej)=>{
                          reader.onload = () => res(reader.result);
                          reader.onerror = rej;
                          reader.readAsDataURL(resizedBlob);
                        });
                        added.push(dataUrl);
                        console.warn('uploadImage returned no url for', file.name);
                      }
                    }catch(err){ console.error('image resize/upload failed', err); toast?.push?.({ message: 'Failed to process image: ' + (err?.message||''), type: 'error' }); }
                  }
                  if(added.length) setForm(prev=>({ ...prev, images: [...(prev.images||[]), ...added] }));
                  e.currentTarget.value = '';
                }} />
                <div className="flex gap-2 mt-2 items-center">
                  {form.images.map((u,i)=> (
                    <div key={i} className="relative">
                      <img src={u} className="w-16 h-16 object-cover rounded" />
                      <button type="button" onClick={() => setForm(prev=>({ ...prev, images: prev.images.filter((_,idx)=> idx !== i) }))} className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-5 h-5 text-xs leading-5">×</button>
                    </div>
                  ))}
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
                <div className="flex items-center gap-2">
                      <label className="flex items-center gap-2 mr-2"><input type="checkbox" checked={!!p.featured} onChange={async (e) => {
                        const v = e.target.checked;
                        try{
                          const r = await fetch('/api/products?id='+p._id, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ featured: v }) });
                          if(!r.ok) throw new Error('update failed');
                          load();
                        }catch(err){ toast?.push?.({ message: 'Failed to update featured: ' + (err.message || 'error'), type: 'error' }); }
                      }} /> Featured</label>
                      <button onClick={()=>{ setEditingId(p._id); setForm({ title: p.title || '', price: p.price || '', sku: p.sku || '', category: p.category || '', stock: p.stock || 0, description: p.description || '', images: p.images || [], featured: !!p.featured }) }} className="px-2 py-1 mr-2">Edit</button>
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
