import { getSession } from 'next-auth/react';
import dbConnect from '@/lib/mongodb';
import Product from '../../models/Product';
import { useEffect, useState } from 'react';
import { useToast } from '@/components/Toast';
import AdminSidebar from '@/components/AdminSidebar';

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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const [updatingFeatured, setUpdatingFeatured] = useState({});
  const [form, setForm] = useState({ title: '', price: '', sku: '', category: '', stock: 9999, description: '', images: [], featuredImage: '', featured: false, originalPrice: '', onSale: false, salePrice: '', tags: [], saleHistory: [] });
  const [editingId, setEditingId] = useState(null);
  const [uploadProgress, setUploadProgress] = useState({});

  async function load(){
    setLoading(true);
    try{
      const res = await fetch('/api/products', { credentials: 'include' });
      const data = await res.json();
      const products = Array.isArray(data) ? data : (data && data.products) || [];
      setProducts(products);
    }catch(e){
      toast?.push?.({ message: 'Unable to load products: '+(e.message||'error'), type: 'error' });
    }finally{
      setLoading(false);
    }
  }

  async function loadCategories(){
    try{
      const r = await fetch('/api/admin/categories', { credentials: 'include' });
      const c = await r.json();
      setCategories(c || []);
    }catch(e){
      console.warn('load categories failed', e);
      toast?.push?.({ message: 'Unable to load categories', type: 'error' });
    }
  }

  function makeThree(src){
    if(!src) return 'XXX';
    const s = String(src).toUpperCase().replace(/[^A-Z0-9]/g,'');
    if(s.length >= 3) return s.slice(0,3);
    return (s + 'XXX').slice(0,3);
  }

  function generateSku(title, categoryValue){
    const a = makeThree(title);
    const cat = categories.find(c => String(c._id || c.id) === String(categoryValue) || (c.name || c.title || '') === String(categoryValue));
    const b = makeThree(cat ? (cat.name || cat.title || '') : '');
    return `${a}-${b}`;
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

  // Handlers extracted from JSX to avoid nested braces inside markup
  async function handleFeaturedFileChange(e){
    const f = e.target.files && e.target.files[0];
    if(!f) return;
    const tmpId = Date.now() + '-' + Math.random().toString(36).slice(2,8);
    try{
      toast?.push?.({ message: 'Uploading featured image...', type: 'info' });
      setUploadProgress(prev=>({ ...prev, [tmpId]: 0 }));
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
    if(e.currentTarget) e.currentTarget.value = '';
  }

  async function handleAlbumFilesChange(e){
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
  }

  // Toggle featured flag for a product (extracted from inline JSX)
  async function handleToggleFeatured(productId, value){
    const v = value;
    // optimistic update
    setProducts(prev => prev.map(it => it._id === productId ? { ...it, featured: v } : it));
    setUpdatingFeatured(prev => ({ ...prev, [productId]: true }));
    toast?.push?.({ message: 'Updating featured...', type: 'info' });
    try{
      const r = await fetch('/api/products?id='+productId, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ featured: v }) });
      if(!r.ok) throw new Error('update failed');
      toast?.push?.({ message: 'Featured updated', type: 'success' });
      load();
    }catch(err){
      // revert
      setProducts(prev => prev.map(it => it._id === productId ? { ...it, featured: !v } : it));
      toast?.push?.({ message: 'Failed to update featured: ' + (err.message || 'error'), type: 'error' });
    }finally{ setUpdatingFeatured(prev => { const n = { ...prev }; delete n[productId]; return n; }); }
  }
  
  async function handleCreate(e){
    e.preventDefault();
    if(!form.title?.trim()){
      toast?.push?.({ message: 'Product title is required', type: 'error' });
      return;
    }
    if(!form.price || Number(form.price) <= 0){
      toast?.push?.({ message: 'Valid product price is required', type: 'error' });
      return;
    }
    setSaving(true);
    // ensure SKU: auto-generate as 3 letters of product name - 3 letters of category (CAPS)
    let finalSku = form.sku && form.sku.trim() ? form.sku.trim().toUpperCase() : '';
    if(!finalSku){
      finalSku = generateSku(form.title || '', form.category);
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
      setForm({ title: '', price: '', sku: '', category: '', stock: 9999, description: '', images: [], featuredImage: '', featured: false });
      setEditingId(null);
      load();
      return;
    }catch(err){
      toast?.push?.({ message: 'Save failed: ' + (err.message||''), type: 'error' });
      return;
    }finally{
      setSaving(false);
    }
  }

  // Create new product flow (POST) — include all fields
  payload = { ...form, price: Number(form.price || 0), originalPrice: form.originalPrice ? Number(form.originalPrice) : undefined, salePrice: form.salePrice ? Number(form.salePrice) : undefined, onSale: !!form.onSale, stock: Number(form.stock || 0), sku: finalSku.toUpperCase(), category: form.category || '', image: featuredUrl || firstImg || '' };
  payload.featured = !!form.featured;
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
    setForm({ title: '', price: '', sku: '', category: '', stock: 9999, description: '', images: [], featuredImage: '', featured: false });
    setEditingId(null);
    load();
  }catch(err){
    toast?.push?.({ message: 'Save failed: ' + (err.message||''), type: 'error' });
  }finally{
    setSaving(false);
  }
  }

  return (
    <div className="p-6">
      <div className="grid md:grid-cols-4 gap-6">
        <AdminSidebar />
        <main className="md:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold">Admin: Products</h1>
            <a href="/admin" className="px-3 py-1 bg-gray-100 rounded">Back to dashboard</a>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white p-4 rounded shadow">
              <h2 className="text-lg font-semibold mb-3">Create / Edit Product</h2>
              <form onSubmit={handleCreate} className="space-y-3">
                <div>
                  <label className="block text-sm font-medium">Title</label>
                  <input value={form.title} onChange={e=>setForm(f=>({...f, title: e.target.value}))} className="w-full p-2 border rounded" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm">Price</label>
                    <input value={form.price} onChange={e=>setForm(f=>({...f, price: e.target.value}))} className="w-full p-2 border rounded" />
                  </div>
                  <div>
                    <label className="block text-sm">Original price (optional)</label>
                    <input value={form.originalPrice} onChange={e=>setForm(f=>({...f, originalPrice: e.target.value}))} className="w-full p-2 border rounded" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm">SKU</label>
                    <input value={form.sku} onChange={e=>setForm(f=>({...f, sku: e.target.value}))} className="w-full p-2 border rounded" />
                  </div>
                  <div>
                    <label className="block text-sm">Stock</label>
                    <input type="number" value={form.stock} onChange={e=>setForm(f=>({...f, stock: e.target.value}))} className="w-full p-2 border rounded" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm">Category</label>
                  <select value={form.category} onChange={e=>setForm(f=>({...f, category: e.target.value}))} className="w-full p-2 border rounded">
                    <option value="">-- choose --</option>
                    {categories.map(c => (<option key={c._id || c.id} value={c.name || c.title || c}>{c.name || c.title || c}</option>))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm">Description</label>
                  <textarea value={form.description} onChange={e=>setForm(f=>({...f, description: e.target.value}))} className="w-full p-2 border rounded" rows={4}></textarea>
                </div>

                <div>
                  <label className="block text-sm">Featured image</label>
                  <input type="file" accept="image/*" onChange={handleFeaturedFileChange} />
                  {form.featuredImage && (typeof form.featuredImage === 'object' ? form.featuredImage.url : form.featuredImage) && (
                    <div className="mt-2"><img src={(form.featuredImage && form.featuredImage.url) || form.featuredImage} alt="featured" className="h-24 object-contain" /></div>
                  )}
                </div>

                <div>
                  <label className="block text-sm">Album images</label>
                  <input type="file" accept="image/*" multiple onChange={handleAlbumFilesChange} />
                  {Array.isArray(form.images) && form.images.length > 0 && (
                    <div className="mt-2 flex gap-2 flex-wrap">{form.images.map((im,idx)=>(<img key={idx} src={im.url || im} alt={`img-${idx}`} className="h-16 object-contain" />))}</div>
                  )}
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={form.onSale} onChange={e=>setForm(f=>({...f, onSale: e.target.checked}))} /> On Sale</label>
                  {form.onSale && (<input value={form.salePrice} onChange={e=>setForm(f=>({...f, salePrice: e.target.value}))} placeholder="Sale price" className="p-2 border rounded" />)}
                  <label className="flex items-center gap-2"><input type="checkbox" checked={form.featured} onChange={e=>setForm(f=>({...f, featured: e.target.checked}))} /> Featured</label>
                </div>

                <div className="flex gap-2">
                  <button disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-60" type="submit">{saving ? (editingId ? 'Saving...' : 'Creating...') : (editingId ? 'Save changes' : 'Create product')}</button>
                  {editingId && <button type="button" onClick={()=>{ setEditingId(null); setForm({ title: '', price: '', sku: '', category: '', stock: 9999, description: '', images: [], featuredImage: '', featured: false }); }} className="px-3 py-2 border rounded">Cancel</button>}
                </div>
              </form>
            </div>

            <div className="bg-white p-4 rounded shadow">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Products</h3>
                <div className="text-sm text-gray-500">{products.length} items</div>
              </div>
              {loading ? (
                <div className="text-sm text-gray-500">Loading products…</div>
              ) : products.length === 0 ? (
                <div className="text-sm text-gray-500">No products found. Add one to start selling.</div>
              ) : (
                <div className="space-y-3">
                  {products.map(p => (
                  <div key={p._id} className="p-3 rounded shadow flex items-center justify-between">
                    <div>
                      <div className="font-medium">{p.title} {p.featured ? <span className="ml-2 inline-flex items-center rounded bg-yellow-100 px-2 py-0.5 text-xs font-semibold text-yellow-800">Featured</span> : null}</div>
                      <div className="text-sm text-gray-600">
                        SKU: {p.sku || '—'} • Price: ₹{Number(p.price||0).toFixed(2)} • Category: {(() => {
                          const cat = categories.find(c => String(c._id || c.id) === String(p.category) || (c.name || c.title || '') === String(p.category));
                          return cat ? (cat.name || cat.title || String(p.category)) : (p.category || '—');
                        })()}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">Stock: {p.stock || 0} • {p.onSale ? `Sale ₹${Number(p.salePrice||0).toFixed(2)}` : 'Regular price'}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={()=>{ setEditingId(p._id); setForm({ ...p, price: p.price, originalPrice: p.originalPrice, salePrice: p.salePrice, sku: (p.sku||'').toUpperCase(), category: p.category || '', featured: !!p.featured, _prev: p }); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="px-2 py-1 border rounded">Edit</button>
                      <button onClick={async ()=>{ if(!confirm('Delete this product?')) return; const r = await fetch('/api/products?id='+p._id, { method: 'DELETE', credentials: 'include' }); if(!r.ok){ toast?.push?.({ message: 'Delete failed', type: 'error' }); return; } load(); }} className="px-2 py-1 border rounded text-red-600">Delete</button>
                      <button onClick={()=>handleToggleFeatured(p._id, !p.featured)} disabled={!!updatingFeatured[p._id]} className="px-2 py-1 border rounded text-sm">{p.featured ? 'Unfeature' : 'Feature'}</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
  // Don't serialize the full product list into the page HTML — fetch client-side to avoid large page data.
  // This reduces initial page payload and prevents Next.js large page data warnings.
  await dbConnect();
  return { props: {} };
}
