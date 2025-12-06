import { getSession } from 'next-auth/react';
import dbConnect from '@/lib/mongodb';
import Product from '../../models/Product';
import { useEffect, useState } from 'react';
import { useToast } from '@/components/Toast';

// client-side resize helper — returns a Blob
async function resizeImage(file, maxWidth = 1200, maxHeight = 1200, quality = 0.8){
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      let { width, height } = img;
      const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
      const w = Math.round(width * ratio);
      const h = Math.round(height * ratio);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url);
        if(blob) resolve(blob);
        else reject(new Error('Canvas toBlob failed'));
      }, 'image/jpeg', quality);
    };
    img.onerror = (err) => { URL.revokeObjectURL(url); reject(err); };
    img.src = url;
  });
}

function blobToDataURL(blob){
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
}

// fetch categories to populate dropdown

export default function AdminProducts({ initial }){
  const [products, setProducts] = useState(initial || []);
  const [categories, setCategories] = useState([]);
  const toast = useToast();
  const [updatingFeatured, setUpdatingFeatured] = useState({});
  const [form, setForm] = useState({ title: '', price: '', sku: '', category: '', stock: 9999, description: '', images: [], featuredImage: '', originalPrice: '', onSale: false, salePrice: '', tags: [], saleHistory: [] });
  const [editingId, setEditingId] = useState(null);
  const [uploadProgress, setUploadProgress] = useState({});

  async function load(){
  const res = await fetch('/api/products', { credentials: 'include' });
    const data = await res.json();
    // Support both array response and paginated { products } shape
    const products = Array.isArray(data) ? data : (data && data.products) || [];
    setProducts(products);
  }

  async function loadCategories(){
    try{ const r = await fetch('/api/admin/categories'); const c = await r.json(); setCategories(c || []); }catch(e){ console.warn('load categories failed', e); }
  }

  useEffect(()=>{ load() },[]);
  useEffect(()=>{ loadCategories(); },[]);

  async function uploadImage(file, onProgress){
    // Server-side upload proxy: send a dataUrl to /api/admin/upload-image
    // Accept optional opts object as third param via `onProgress` if desired
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
      // Use fetch with credentials so cookies (next-auth) are sent. Note: fetch doesn't provide upload progress.
      try{
        if(typeof onProgress === 'function') onProgress(0);
        const res = await fetch('/api/admin/upload-image', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dataUrl })
        });
        const json = await res.json().catch(()=>({}));
        if(!res.ok) {
          const msg = (json && (json.error || (json.details && JSON.stringify(json.details)) || JSON.stringify(json))) || 'Upload failed';
          throw new Error(msg);
        }
        if(typeof onProgress === 'function') onProgress(100);
        return json;
      }catch(err){ throw err; }
    }catch(e){
      console.error('uploadImage error', e);
      const msg = e?.message || (typeof e === 'string' ? e : JSON.stringify(e));
      toast?.push?.({ message: 'Upload error: ' + msg, type: 'error' });
      return null;
    }
  }
  
  async function handleCreate(e){
    e.preventDefault();
    // ensure SKU
    let finalSku = form.sku && form.sku.trim() ? form.sku.trim() : '';
    if(!finalSku){
      const slug = (form.title + ' ' + (form.category||'')).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
      finalSku = (slug || 'item') + '-' + String(Date.now()).slice(-5);
    }
  const featuredUrl = form.featuredImage && typeof form.featuredImage === 'object' ? (form.featuredImage.url || '') : form.featuredImage;
  const firstImg = (form.images && form.images[0]) ? (typeof form.images[0] === 'object' ? (form.images[0].url || '') : form.images[0]) : '';
  // Build payload. For edits, only send fields that are intended to change to avoid overwriting images/originalPrice with empty values.
  let payload;
  if(editingId){
    payload = {
      // always allow title/price/sku/category/stock/description updates
      title: form.title,
      price: Number(form.price || 0),
      sku: finalSku,
      category: form.category,
      stock: Number(form.stock || 0),
      description: form.description,
      onSale: !!form.onSale,
      featured: !!form.featured
    };
    // include originalPrice only if provided (not empty string / undefined)
    if(form.originalPrice !== undefined && form.originalPrice !== '') payload.originalPrice = Number(form.originalPrice || 0);
    // include images array if present (length > 0)
    if(Array.isArray(form.images) && form.images.length) payload.images = form.images;
    // include featuredImage if present
    if(form.featuredImage) payload.featuredImage = form.featuredImage;
    // include legacy image field only if we have a value
    const imgVal = featuredUrl || firstImg;
    if(imgVal) payload.image = imgVal;

    // sale handling: include salePrice if provided
    if(form.onSale){
      if(form.salePrice !== undefined && form.salePrice !== '') payload.salePrice = Number(form.salePrice || 0);
      // ensure tags includes SALE!
      const prevTags = (form.tags || (form._prev && form._prev.tags) || []);
      const tags = Array.from(new Set([...(prevTags || []), 'SALE!']));
      payload.tags = tags;
      // append a saleHistory entry if this is a newly started sale
      const prev = form._prev || {};
      const wasOnSale = !!prev.onSale;
      const history = Array.isArray(prev.saleHistory) ? [...prev.saleHistory] : [];
      if(!wasOnSale){
        history.push({ price: Number(form.salePrice || form.salePrice === 0 ? form.salePrice : form.price), startAt: new Date().toISOString(), active: true });
      }
      if(history.length) payload.saleHistory = history;
    } else {
      // turning off sale: clear sale flag and mark last saleHistory entry inactive
      const prev = form._prev || {};
      if(prev && Array.isArray(prev.saleHistory) && prev.saleHistory.length){
        const history = prev.saleHistory.map((h,i)=> i===prev.saleHistory.length-1 ? ({ ...h, endAt: new Date().toISOString(), active: false }) : h );
        payload.saleHistory = history;
      }
      // remove SALE! tag if present
      const prevTags = (form.tags || (form._prev && form._prev.tags) || []);
      payload.tags = (prevTags || []).filter(t => t !== 'SALE!');
    }

    const url = `/api/products?id=${editingId}`;
    try{
      const res = await fetch(url, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if(!res.ok) { toast?.push?.({ message: data?.error || 'Failed to save product', type: 'error' }); return; }
      toast?.push?.({ message: 'Product updated', type: 'success' });
      setForm({ title: '', price: '', sku: '', category: '', stock: 9999, description: '', images: [], featuredImage: '' });
      setEditingId(null);
      load();
      return;
    }catch(err){ toast?.push?.({ message: 'Save failed: ' + (err.message||''), type: 'error' }); return; }
  }

  // Create new product flow (POST) — include all fields
  payload = { ...form, price: Number(form.price || 0), originalPrice: form.originalPrice ? Number(form.originalPrice) : undefined, salePrice: form.salePrice ? Number(form.salePrice) : undefined, onSale: !!form.onSale, stock: Number(form.stock || 0), sku: finalSku, image: featuredUrl || firstImg || '' };
  // if creating and onSale selected, add SALE! tag and initial saleHistory entry
  if(payload.onSale){
    payload.tags = Array.from(new Set([...(payload.tags||[]), 'SALE!']));
    const histPrice = payload.salePrice || payload.price;
    payload.saleHistory = [{ price: Number(histPrice||0), startAt: new Date().toISOString(), active: true }];
  }
  const url = '/api/products';
  const method = 'POST';
  try{
    const res = await fetch(url, { method, credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await res.json();
    if(!res.ok) { toast?.push?.({ message: data?.error || 'Failed to save product', type: 'error' }); return; }
    toast?.push?.({ message: 'Product created', type: 'success' });
    setForm({ title: '', price: '', sku: '', category: '', stock: 9999, description: '', images: [], featuredImage: '' });
    setEditingId(null);
    load();
  }catch(err){ toast?.push?.({ message: 'Save failed: ' + (err.message||''), type: 'error' }); }
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
            {form.onSale && (
              <div className="mb-2">
                <input type="number" value={form.salePrice || ''} onChange={e=>setForm({...form, salePrice: e.target.value})} placeholder="Sale price" className="w-full p-2 border mb-2" />
                <div className="text-xs text-gray-500">Checking this will tag product as <strong>SALE!</strong></div>
              </div>
            )}
            <input value={form.sku} onChange={e=>setForm({...form, sku: e.target.value})} placeholder="SKU" className="w-full p-2 border mb-2" />
            <select value={form.category} onChange={e=>setForm({...form, category: e.target.value})} className="w-full p-2 border mb-2">
              <option value="">Select category</option>
              {categories.map(c => (<option key={c._id} value={c.name}>{c.name}</option>))}
            </select>
            <input value={form.stock} onChange={e=>setForm({...form, stock: e.target.value})} placeholder="Stock" className="w-full p-2 border mb-2" />
            <textarea value={form.description} onChange={e=>setForm({...form, description: e.target.value})} placeholder="Description" className="w-full p-2 border mb-2" />
            <div className="mb-2">
              <label className="block mb-1">Featured image (main)</label>
              <div className="flex items-center gap-3 mb-2">
                <input type="file" accept="image/*" onChange={async e=>{
                  const f = e.target.files && e.target.files[0];
                  if(!f) return;
                  const tmpId = Date.now() + '-' + Math.random().toString(36).slice(2,8);
                  try{
                    toast?.push?.({ message: 'Uploading featured image...', type: 'info' });
                    setUploadProgress(prev=>({ ...prev, [tmpId]: 0 }));
                    // resize to a reasonable max for original upload
                    const resized = await resizeImage(f, 2000, 2000, 0.9);
                    const fileToUpload = new File([resized], f.name || 'img.jpg', { type: resized.type });
                    const body = await uploadImage(fileToUpload, pct => setUploadProgress(prev=>({ ...prev, [tmpId]: pct })));
                    if(body){
                      const public_id = body.raw?.public_id || body.public_id;
                      const url = body.secure_url || body.url;
                      setForm(prev => ({ ...prev, featuredImage: { public_id, url } }));
                      toast?.push?.({ message: 'Featured image uploaded', type: 'success' });
                    }
                  }catch(err){ console.error('featured image process failed', err); toast?.push?.({ message: 'Failed to process featured image: ' + (err?.message||''), type: 'error' }); }
                  setUploadProgress(prev => { const n = { ...prev }; delete n[tmpId]; return n; });
                  // clear input value so same file can be picked again if needed
                  if(e.currentTarget) e.currentTarget.value = '';
                }} />
                {form.featuredImage ? (<img src={typeof form.featuredImage === 'string' ? form.featuredImage : (form.featuredImage?.url || '')} className="w-20 h-20 object-cover rounded" />) : (<div className="w-20 h-20 bg-gray-100 rounded flex items-center justify-center text-sm text-gray-500">No image</div>)}
              </div>

              <label className="block mb-1">Product album (multiple)</label>
              <input type="file" accept="image/*" multiple onChange={async e=>{
                const files = Array.from(e.target.files || []);
                if(files.length === 0) return;
                const added = [];
                for(const file of files){
                  const tmpId = Date.now() + '-' + Math.random().toString(36).slice(2,8);
                  try{
                    toast?.push?.({ message: 'Uploading image...', type: 'info' });
                    setUploadProgress(prev=>({ ...prev, [tmpId]: 0 }));
                    const resized = await resizeImage(file, 2000, 2000, 0.9);
                    const fileToUpload = new File([resized], file.name || 'img.jpg', { type: resized.type });
                    const body = await uploadImage(fileToUpload, pct => setUploadProgress(prev=>({ ...prev, [tmpId]: pct })));
                    if(body){
                      const public_id = body.raw?.public_id || body.public_id;
                      const url = body.secure_url || body.url;
                      added.push({ public_id, url });
                      toast?.push?.({ message: 'Image uploaded', type: 'success' });
                    }
                  }catch(err){ console.error('image upload failed', err); toast?.push?.({ message: 'Failed to process image: ' + (err?.message||''), type: 'error' }); }
                  setUploadProgress(prev => { const n = { ...prev }; delete n[tmpId]; return n; });
                }
                if(added.length) setForm(prev => ({ ...prev, images: [...(prev.images||[]), ...added] }));
                if(e.currentTarget) e.currentTarget.value = '';
              }} />

              <div className="flex gap-2 mt-2 items-center">
                {(form.images||[]).map((u,i)=> (
                  <div key={i} className="relative">
                    <img src={typeof u === 'string' ? u : (u.url || u.card || u.large || u.thumb || '')} className="w-16 h-16 object-cover rounded" />
                    <button type="button" onClick={() => setForm(prev=>({ ...prev, images: prev.images.filter((_,idx)=> idx !== i) }))} className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-5 h-5 text-xs leading-5">×</button>
                  </div>
                ))}
              </div>
            </div>
            <div className="mb-2"><label><input type="checkbox" checked={!!form.featured} onChange={e=>setForm({...form, featured: e.target.checked})} /> Featured</label></div>
            <button className="px-4 py-2 btn-primary rounded">{editingId ? 'Update' : 'Create'}</button>
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
                      <label className="flex items-center gap-2 mr-2">
                        <input type="checkbox" checked={!!p.featured} disabled={!!updatingFeatured[p._id]} onChange={async (e) => {
                          const v = e.target.checked;
                          // optimistic update
                          setProducts(prev => prev.map(it => it._id === p._id ? { ...it, featured: v } : it));
                          setUpdatingFeatured(prev => ({ ...prev, [p._id]: true }));
                          toast?.push?.({ message: 'Updating featured...', type: 'info' });
                          try{
                            const r = await fetch('/api/products?id='+p._id, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ featured: v }) });
                            if(!r.ok) throw new Error('update failed');
                            toast?.push?.({ message: 'Featured updated', type: 'success' });
                            load();
                          }catch(err){
                            // revert
                            setProducts(prev => prev.map(it => it._id === p._id ? { ...it, featured: !v } : it));
                            toast?.push?.({ message: 'Failed to update featured: ' + (err.message || 'error'), type: 'error' });
                          }finally{ setUpdatingFeatured(prev => { const n = { ...prev }; delete n[p._id]; return n; }); }
                        }} /> Featured
                      </label>
                      <button onClick={()=>{
                        setEditingId(p._id);
                        // populate the form with all relevant fields so edits don't wipe other values
                                            setForm({
                                              title: p.title || '',
                                              price: p.price || '',
                                              originalPrice: p.originalPrice !== undefined ? p.originalPrice : '',
                                              salePrice: p.salePrice !== undefined ? p.salePrice : '',
                                              sku: p.sku || '',
                                              category: p.category || '',
                                              stock: p.stock || 0,
                                              description: p.description || '',
                                              images: p.images || [],
                                              featuredImage: p.featuredImage || (p.image ? (typeof p.image === 'string' ? p.image : (p.image.url || '')) : ''),
                                              featured: !!p.featured,
                                              onSale: !!p.onSale,
                                              tags: p.tags || [],
                                              saleHistory: p.saleHistory || [],
                                              // keep a copy of previous product for change detection
                                              _prev: p
                                            });
                      }} className="px-2 py-1 mr-2">Edit</button>
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
  // Don't serialize the full product list into the page HTML — fetch client-side to avoid large page data.
  // This reduces initial page payload and prevents Next.js large page data warnings.
  await dbConnect();
  return { props: {} };
}
