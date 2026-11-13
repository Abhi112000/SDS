import { getSession } from 'next-auth/react';
import dbConnect from '@/lib/mongodb';
import Product from '../../models/Product';
import { useEffect, useRef, useState } from 'react';
import { useToast } from '@/components/Toast';
import AdminSidebar from '@/components/AdminSidebar';
import { authRedirect } from '@/lib/authRedirect';
import { getProductIdeas } from '@/lib/productIdeas';

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
  const [form, setForm] = useState({ title: '', price: '', sku: '', category: '', stock: 9999, description: '', images: [], featuredImage: '', featured: false, isNewArrival: false, originalPrice: '', onSale: false, salePrice: '', tags: [], saleHistory: [] });
  const [editingId, setEditingId] = useState(null);
  const [uploadProgress, setUploadProgress] = useState({});
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkRows, setBulkRows] = useState([]);
  const [bulkDecisions, setBulkDecisions] = useState({});
  const [bulkBusy, setBulkBusy] = useState(false);
  const [ideaQuery, setIdeaQuery] = useState('');
  const [ideaCategory, setIdeaCategory] = useState('');
  const [selectedIdeas, setSelectedIdeas] = useState([]);
  const [ideaBatchRows, setIdeaBatchRows] = useState([]);
  const [ideaBatchPreview, setIdeaBatchPreview] = useState([]);
  const [ideaBatchDecisions, setIdeaBatchDecisions] = useState({});
  const [ideaBatchBusy, setIdeaBatchBusy] = useState(false);
  const [newIdeaCategory, setNewIdeaCategory] = useState('');
  const [showNewIdeaCategory, setShowNewIdeaCategory] = useState(false);
  const [savingIdeaCategory, setSavingIdeaCategory] = useState(false);
  const [researchUrl, setResearchUrl] = useState('');
  const [researchBusy, setResearchBusy] = useState(false);
  const [researchResult, setResearchResult] = useState(null);
  const [researchImage, setResearchImage] = useState('');
  const productFormRef = useRef(null);
  const productIdeas = getProductIdeas(ideaQuery);
  const ideaKey = idea => `${idea.category || ''}::${idea.title}`;

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

  async function createIdeaCategory(){
    const trimmedName = newIdeaCategory.trim();
    if(!trimmedName) return toast?.push?.({ message: 'Enter a category name', type: 'error' });
    const existing = categories.find(category => String(category.name || '').toLowerCase() === trimmedName.toLowerCase());
    if(existing){
      setIdeaCategory(existing.name);
      setForm(previous => ({ ...previous, category: existing.name }));
      setNewIdeaCategory('');
      setShowNewIdeaCategory(false);
      return toast?.push?.({ message: `Using existing category "${existing.name}"`, type: 'info' });
    }
    setSavingIdeaCategory(true);
    try{
      const response = await fetch('/api/admin/categories', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedName })
      });
      const body = await response.json();
      if(!response.ok) throw new Error(body.error || 'Unable to create category');
      setCategories(previous => previous.some(category => String(category._id) === String(body._id)) ? previous : [...previous, body]);
      setIdeaCategory(body.name);
      setForm(previous => ({ ...previous, category: body.name }));
      setNewIdeaCategory('');
      setShowNewIdeaCategory(false);
      toast?.push?.({ message: `Category "${body.name}" added`, type: 'success' });
    }catch(error){
      toast?.push?.({ message: error.message || 'Unable to create category', type: 'error' });
    }finally{
      setSavingIdeaCategory(false);
    }
  }

  function useProductIdea(idea){
    const existingCategory = categories.find(category => String(category.name || '').toLowerCase() === String(idea.category || '').toLowerCase());
    setEditingId(null);
    setForm(previous => ({
      ...previous,
      title: idea.title,
      category: ideaCategory || existingCategory?.name || '',
      price: '',
      originalPrice: '',
      sku: '',
      stock: 0,
      description: '',
      images: [],
      featuredImage: '',
      featured: false,
      isNewArrival: false,
      onSale: false,
      salePrice: '',
      tags: [],
      saleHistory: []
    }));
    productFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    toast?.push?.({ message: 'Idea loaded into the product form. Add price, stock and product details.', type: 'info' });
  }

  function toggleProductIdea(idea){
    const key = ideaKey(idea);
    setSelectedIdeas(previous => previous.some(item => ideaKey(item) === key)
      ? previous.filter(item => ideaKey(item) !== key)
      : [...previous, idea]);
  }

  function addIdeasToBatch(){
    if(!selectedIdeas.length) return;
    setIdeaBatchRows(previous => {
      const existing = new Set(previous.map(row => `${row.category || ''}::${row.title.toLowerCase()}`));
      const additions = [];
      selectedIdeas.forEach(idea => {
        const category = ideaCategory || idea.category || 'General';
        const key = `${category}::${idea.title.toLowerCase()}`;
        if(existing.has(key)) return;
        existing.add(key);
        additions.push({
          title: idea.title,
          description: '',
          price: '',
          originalPrice: '',
          stock: 0,
          featured: false,
          category
        });
      });
      return [...previous, ...additions];
    });
    setIdeaBatchPreview([]);
    setSelectedIdeas([]);
    toast?.push?.({ message: 'Selected ideas added to the batch. Enter each item’s price and stock, then preview.', type: 'success' });
  }

  function updateIdeaBatchRow(index, patch){
    setIdeaBatchRows(previous => previous.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
    setIdeaBatchPreview([]);
  }

  async function previewIdeaBatch(){
    if(!ideaBatchRows.length) return;
    setIdeaBatchBusy(true);
    try{
      const response = await fetch('/api/admin/products/bulk', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: ideaBatchRows })
      });
      const body = await response.json();
      if(!response.ok) throw new Error(body.error || 'Unable to preview product batch');
      setIdeaBatchPreview(body.rows || []);
      setIdeaBatchDecisions(Object.fromEntries((body.rows || []).filter(row => row.duplicate).map(row => [String(row.rowNumber), 'skip'])));
      const invalid = (body.rows || []).filter(row => row.errors?.length).length;
      toast?.push?.({ message: invalid ? `${invalid} row(s) need valid title, price or stock.` : `Preview ready for ${(body.rows || []).length} products.`, type: invalid ? 'error' : 'success' });
    }catch(error){
      toast?.push?.({ message: error.message || 'Unable to preview product batch', type: 'error' });
    }finally{
      setIdeaBatchBusy(false);
    }
  }

  async function createIdeaBatch(){
    const invalid = ideaBatchPreview.filter(row => row.errors?.length);
    if(invalid.length) return toast?.push?.({ message: 'Fix invalid rows before creating products', type: 'error' });
    if(!ideaBatchPreview.length) return;
    setIdeaBatchBusy(true);
    try{
      const response = await fetch('/api/admin/products/bulk', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: ideaBatchPreview, decisions: ideaBatchDecisions, commit: true })
      });
      const body = await response.json();
      if(!response.ok) throw new Error(body.error || 'Unable to create products');
      toast?.push?.({ message: `Batch complete: ${body.created} created, ${body.updated} updated, ${body.skipped} skipped.`, type: 'success' });
      setIdeaBatchRows([]);
      setIdeaBatchPreview([]);
      setIdeaBatchDecisions({});
      load();
    }catch(error){
      toast?.push?.({ message: error.message || 'Unable to create products', type: 'error' });
    }finally{
      setIdeaBatchBusy(false);
    }
  }

  async function researchProductPage(event){
    event.preventDefault();
    if(!researchUrl.trim()) return toast?.push?.({ message: 'Paste a product page URL first', type: 'error' });
    setResearchBusy(true);
    setResearchResult(null);
    setResearchImage('');
    try{
      const response = await fetch('/api/admin/products/research', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: researchUrl.trim() })
      });
      const body = await response.json();
      if(!response.ok) throw new Error(body.error || 'Unable to read product page');
      setResearchResult(body);
      setResearchImage(body.product.images[0] || '');
      toast?.push?.({ message: 'Product page details extracted. Review them before using.', type: 'success' });
    }catch(error){
      toast?.push?.({ message: error.message || 'Product page import failed', type: 'error' });
    }finally{
      setResearchBusy(false);
    }
  }

  function useResearchResult(useImage){
    if(!researchResult?.product) return;
    const product = researchResult.product;
    const sourceCategory = categories.find(category => String(category.name || '').toLowerCase() === String(product.category || '').toLowerCase());
    const suggestedCategory = ideaCategory || sourceCategory?.name || '';
    setEditingId(null);
    setForm(previous => ({
      ...previous,
      title: product.title || previous.title,
      description: product.description || previous.description,
      category: suggestedCategory,
      price: '',
      originalPrice: '',
      sku: '',
      stock: 0,
      images: useImage && researchImage ? [researchImage] : [],
      featuredImage: useImage ? researchImage : '',
      featured: false,
      isNewArrival: false,
      onSale: false,
      salePrice: '',
      tags: [],
      saleHistory: []
    }));
    if(product.category && !sourceCategory && !ideaCategory){
      setNewIdeaCategory(product.category);
      setShowNewIdeaCategory(true);
    }
    productFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    toast?.push?.({ message: useImage && product.images[0] ? 'Details and image loaded. Check source image rights before saving.' : 'Product details loaded. Set SDS price, SKU and stock before saving.', type: 'info' });
  }

  async function downloadBulkTemplate(existing = false){
    try{
      const res = await fetch(`/api/admin/products/bulk${existing ? '?existing=1' : ''}`, { credentials: 'include' });
      if(!res.ok) throw new Error('Unable to create template');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = existing ? 'products-existing.xlsx' : 'products-template.xlsx';
      link.click();
      URL.revokeObjectURL(url);
    }catch(error){
      toast?.push?.({ message: error.message || 'Template download failed', type: 'error' });
    }
  }

  function readFileAsBase64(file){
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function previewBulkImport(){
    if(!bulkFile) return toast?.push?.({ message: 'Select an Excel file first', type: 'error' });
    setBulkBusy(true);
    try{
      const fileBase64 = await readFileAsBase64(bulkFile);
      const res = await fetch('/api/admin/products/bulk', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileBase64 }) });
      const data = await res.json();
      if(!res.ok) throw new Error(data.error || 'Preview failed');
      setBulkRows(data.rows || []);
      setBulkDecisions(Object.fromEntries((data.rows || []).filter(row => row.duplicate).map(row => [String(row.rowNumber), row.matchType === 'productId' && row.changed ? 'update' : 'skip'])));
      if(!(data.rows || []).length) toast?.push?.({ message: 'No product rows found in this Excel file', type: 'info' });
    }catch(error){
      toast?.push?.({ message: error.message || 'Preview failed', type: 'error' });
    }finally{ setBulkBusy(false); }
  }

  async function importBulkProducts(){
    const invalid = bulkRows.filter(row => row.errors?.length);
    if(invalid.length) return toast?.push?.({ message: 'Fix invalid rows in the Excel file before importing', type: 'error' });
    setBulkBusy(true);
    try{
      const fileBase64 = await readFileAsBase64(bulkFile);
      const res = await fetch('/api/admin/products/bulk', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileBase64, rows: bulkRows, decisions: bulkDecisions, commit: true }) });
      const data = await res.json();
      if(!res.ok) throw new Error(data.error || 'Import failed');
      toast?.push?.({ message: `Imported ${data.created} new, updated ${data.updated}, skipped ${data.skipped}`, type: 'success' });
      setBulkFile(null);
      setBulkRows([]);
      setBulkDecisions({});
      load();
    }catch(error){
      toast?.push?.({ message: error.message || 'Import failed', type: 'error' });
    }finally{ setBulkBusy(false); }
  }

  function updateBulkRow(rowNumber, field, value){
    setBulkRows(prev => prev.map(row => row.rowNumber === rowNumber ? { ...row, [field]: value, changed: row.productId ? true : row.changed, errors: [] } : row));
    const row = bulkRows.find(item => item.rowNumber === rowNumber);
    if(row?.productId) setBulkDecisions(prev => ({ ...prev, [String(rowNumber)]: 'update' }));
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
      featured: !!form.featured,
      isNewArrival: !!form.isNewArrival
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
      setForm({ title: '', price: '', sku: '', category: '', stock: 9999, description: '', images: [], featuredImage: '', featured: false, isNewArrival: false });
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
  payload = { ...form, price: Number(form.price || 0), originalPrice: form.originalPrice ? Number(form.originalPrice) : undefined, salePrice: form.salePrice ? Number(form.salePrice) : undefined, onSale: !!form.onSale, stock: Number(form.stock || 0), sku: finalSku.toUpperCase(), category: form.category || '', image: featuredUrl || firstImg || '', isNewArrival: !!form.isNewArrival };
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
    setForm({ title: '', price: '', sku: '', category: '', stock: 9999, description: '', images: [], featuredImage: '', featured: false, isNewArrival: false });
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

          <section className="bg-white p-4 rounded shadow mb-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Bulk import products</h2>
                <p className="text-sm text-gray-600">Download the category-wise Excel template. SKU and images are managed separately.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={()=>downloadBulkTemplate(false)} className="px-3 py-2 border rounded">Download blank template</button>
                <button type="button" onClick={()=>downloadBulkTemplate(true)} className="px-3 py-2 border rounded">Download existing products</button>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <input type="file" accept=".xlsx,.xls" onChange={e=>{ setBulkFile(e.target.files?.[0] || null); setBulkRows([]); }} />
              <button type="button" onClick={previewBulkImport} disabled={!bulkFile || bulkBusy} className="px-3 py-2 bg-blue-600 text-white rounded disabled:opacity-60">{bulkBusy ? 'Reading...' : 'Preview import'}</button>
            </div>
            {bulkRows.length > 0 && (
              <div className="mt-4 overflow-auto">
                <table className="w-full text-sm border-collapse">
                  <thead><tr className="text-left border-b"><th className="p-2">Row</th><th className="p-2">Title</th><th className="p-2">Description</th><th className="p-2">Price</th><th className="p-2">Original</th><th className="p-2">Sale price</th><th className="p-2">On sale</th><th className="p-2">Stock</th><th className="p-2">Featured</th><th className="p-2">Category</th><th className="p-2">Status</th><th className="p-2">Action</th></tr></thead>
                  <tbody>{bulkRows.map(row => (
                    <tr key={row.rowNumber} className="border-b align-top">
                      <td className="p-2">{row.rowNumber}</td>
                      <td className="p-2"><input value={row.title} onChange={e=>updateBulkRow(row.rowNumber, 'title', e.target.value)} className="w-40 p-1 border rounded" /></td>
                      <td className="p-2"><input value={row.description} onChange={e=>updateBulkRow(row.rowNumber, 'description', e.target.value)} className="w-52 p-1 border rounded" /></td>
                      <td className="p-2"><input type="number" value={row.price} onChange={e=>updateBulkRow(row.rowNumber, 'price', Number(e.target.value))} className="w-24 p-1 border rounded" /></td>
                      <td className="p-2"><input type="number" value={row.originalPrice ?? ''} onChange={e=>updateBulkRow(row.rowNumber, 'originalPrice', e.target.value === '' ? undefined : Number(e.target.value))} className="w-24 p-1 border rounded" /></td>
                      <td className="p-2"><input type="number" value={row.salePrice ?? ''} onChange={e=>updateBulkRow(row.rowNumber, 'salePrice', e.target.value === '' ? undefined : Number(e.target.value))} className="w-24 p-1 border rounded" /></td>
                      <td className="p-2"><input type="checkbox" checked={!!row.onSale} onChange={e=>updateBulkRow(row.rowNumber, 'onSale', e.target.checked)} /></td>
                      <td className="p-2"><input type="number" value={row.stock} onChange={e=>updateBulkRow(row.rowNumber, 'stock', Number(e.target.value))} className="w-20 p-1 border rounded" /></td>
                      <td className="p-2"><input type="checkbox" checked={!!row.featured} onChange={e=>updateBulkRow(row.rowNumber, 'featured', e.target.checked)} /></td>
                      <td className="p-2"><input value={row.category} onChange={e=>updateBulkRow(row.rowNumber, 'category', e.target.value)} className="w-28 p-1 border rounded" /></td>
                      <td className={`p-2 ${row.errors?.length ? 'text-red-600' : row.duplicate ? (row.changed ? 'text-orange-600' : 'text-gray-500') : 'text-green-600'}`}>{row.errors?.length ? row.errors.join(', ') : row.duplicate ? (row.changed ? 'Existing - changed' : 'Existing - unchanged') : 'New product'}</td>
                      <td className="p-2">{row.duplicate ? <select value={bulkDecisions[String(row.rowNumber)] || 'skip'} onChange={e=>setBulkDecisions(prev=>({...prev, [String(row.rowNumber)]: e.target.value}))} className="p-1 border rounded"><option value="skip">Skip</option><option value="update">Update existing</option></select> : 'Create'}</td>
                    </tr>
                  ))}</tbody>
                </table>
                <button type="button" onClick={importBulkProducts} disabled={bulkBusy} className="mt-4 px-4 py-2 bg-green-600 text-white rounded disabled:opacity-60">{bulkBusy ? 'Importing...' : 'Confirm and import'}</button>
              </div>
            )}
          </section>

          <section className="bg-white p-4 rounded shadow mb-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Product Research Assistant</h2>
                <p className="text-sm text-gray-600">Free product ideas plus a product-page importer. Google helps you discover sources; this tool reads only a product page you choose.</p>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">No paid search or AI API</span>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(180px,0.6fr)_auto]">
              <input value={ideaQuery} onChange={event=>setIdeaQuery(event.target.value)} placeholder="Try pencils, gel pen, notebook, art supplies..." className="w-full p-2 border rounded" />
              <select value={ideaCategory} onChange={event=>setIdeaCategory(event.target.value)} className="w-full p-2 border rounded">
                <option value="">Use suggested category if available</option>
                {categories.map(category => <option key={category._id || category.id} value={category.name}>{category.name}</option>)}
              </select>
              <button type="button" onClick={()=>setShowNewIdeaCategory(previous => !previous)} className="px-3 py-2 border rounded">+ Add category</button>
            </div>
            {showNewIdeaCategory && (
              <div className="mt-2 flex flex-wrap gap-2">
                <input value={newIdeaCategory} onChange={event=>setNewIdeaCategory(event.target.value)} onKeyDown={event=>{ if(event.key === 'Enter'){ event.preventDefault(); createIdeaCategory(); } }} placeholder="New category name" className="min-w-[220px] flex-1 p-2 border rounded" />
                <button type="button" onClick={createIdeaCategory} disabled={savingIdeaCategory} className="px-3 py-2 bg-blue-600 text-white rounded disabled:opacity-60">{savingIdeaCategory ? 'Adding...' : 'Save category'}</button>
              </div>
            )}
            {ideaQuery.trim() && (
              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                <a className="rounded border px-3 py-2 text-blue-700 hover:bg-blue-50" href={`https://www.google.com/search?tbm=shop&q=${encodeURIComponent(`${ideaQuery} stationery India`)}`} target="_blank" rel="noreferrer">Find products on Google Shopping ↗</a>
                <a className="rounded border px-3 py-2 text-blue-700 hover:bg-blue-50" href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(`${ideaQuery} stationery product`)}`} target="_blank" rel="noreferrer">Browse Google Images ↗</a>
              </div>
            )}
            <form onSubmit={researchProductPage} className="mt-4 rounded-lg border bg-slate-50 p-3">
              <label className="block text-sm font-medium" htmlFor="research-product-url">Import details from a product page</label>
              <p className="mt-1 text-xs text-slate-600">Open a product from search, copy its product-page URL here. The tool reads page metadata only; it does not scrape Google search results.</p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input id="research-product-url" type="url" required value={researchUrl} onChange={event=>setResearchUrl(event.target.value)} placeholder="https://retailer.example/product/..." className="min-w-0 flex-1 p-2 border rounded" />
                <button type="submit" disabled={researchBusy} className="rounded bg-slate-800 px-3 py-2 text-white disabled:opacity-60">{researchBusy ? 'Reading page…' : 'Read product page'}</button>
              </div>
            </form>
            {researchResult?.product && (
              <article className="mt-3 rounded-lg border border-blue-200 bg-blue-50/50 p-3">
                <div className="flex flex-col gap-3 sm:flex-row">
                {researchImage && <img src={researchImage} alt={researchResult.product.title || 'Product page image'} referrerPolicy="no-referrer" className="h-28 w-28 rounded border bg-white object-contain p-1" />}
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold">{researchResult.product.title || 'Product metadata found'}</h3>
                    <p className="mt-1 text-xs text-slate-600">Source: <a href={researchResult.sourceUrl} target="_blank" rel="noreferrer" className="break-all underline">{new URL(researchResult.sourceUrl).hostname}</a> • {researchResult.product.structuredProductFound ? 'Structured product data' : 'Page metadata'}</p>
                    {researchResult.product.brand && <p className="mt-1 text-sm">Brand: {researchResult.product.brand}</p>}
                    {researchResult.product.sourcePrice != null && <p className="mt-1 text-sm">Source price: {researchResult.product.currency || 'currency not stated'} {researchResult.product.sourcePrice} <span className="text-xs text-slate-500">(reference only; not copied to your selling price)</span></p>}
                    {researchResult.product.description && <p className="mt-2 line-clamp-3 text-sm text-slate-700">{researchResult.product.description}</p>}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" onClick={()=>useResearchResult(false)} className="rounded bg-blue-700 px-3 py-1.5 text-sm text-white">Use details</button>
                      {researchImage && <button type="button" onClick={()=>useResearchResult(true)} className="rounded border border-blue-700 px-3 py-1.5 text-sm text-blue-800">Use details + selected image</button>}
                    </div>
                  </div>
                </div>
                {researchResult.product.images.length > 1 && <div className="mt-3 flex flex-wrap gap-2">{researchResult.product.images.map(image => <button key={image} type="button" onClick={()=>setResearchImage(image)} className={`rounded border p-1 ${researchImage === image ? 'border-blue-700 ring-2 ring-blue-300' : 'border-slate-300'}`} aria-label="Select product image"><img src={image} alt="" referrerPolicy="no-referrer" className="h-14 w-14 bg-white object-contain" /></button>)}</div>}
                <p className="mt-3 text-xs text-slate-600">Verify the name and details against the item you stock. Source prices can be outdated; only use images you have permission to publish.</p>
              </article>
            )}
            {ideaQuery.trim() && productIdeas.length > 0 && (
              <div className="mt-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-slate-600">Select multiple ideas to prepare them together.</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={()=>setSelectedIdeas(productIdeas)} className="rounded border px-3 py-1.5 text-sm">Select all {productIdeas.length}</button>
                    <button type="button" onClick={()=>setSelectedIdeas([])} className="rounded border px-3 py-1.5 text-sm">Clear selection</button>
                    <button type="button" onClick={addIdeasToBatch} disabled={!selectedIdeas.length} className="rounded bg-emerald-700 px-3 py-1.5 text-sm text-white disabled:opacity-50">Add selected ({selectedIdeas.length}) to batch</button>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {productIdeas.map(idea => (
                  <article key={ideaKey(idea)} className={`flex items-center justify-between gap-2 rounded border p-3 ${selectedIdeas.some(item => ideaKey(item) === ideaKey(idea)) ? 'border-blue-500 bg-blue-50' : ''}`}>
                    <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2">
                      <input type="checkbox" checked={selectedIdeas.some(item => ideaKey(item) === ideaKey(idea))} onChange={()=>toggleProductIdea(idea)} className="mt-1" />
                      <span>
                      <div className="font-medium text-sm">{idea.title}</div>
                      {idea.category && <div className="mt-1 text-xs text-gray-500">Suggested category: {idea.category}</div>}
                      </span>
                    </label>
                    <button type="button" onClick={()=>useProductIdea(idea)} className="shrink-0 rounded border px-2 py-1.5 text-xs">Use one</button>
                  </article>
                ))}
                </div>
              </div>
            )}
            {ideaBatchRows.length > 0 && (
              <section className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50/40 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">Batch product setup ({ideaBatchRows.length})</h3>
                    <p className="text-xs text-slate-600">Set each item’s selling price and stock. SKUs are generated automatically; source suggestions do not set prices.</p>
                  </div>
                  <button type="button" onClick={()=>{ setIdeaBatchRows([]); setIdeaBatchPreview([]); }} className="rounded border px-3 py-1.5 text-sm">Clear batch</button>
                </div>
                <div className="mt-3 space-y-2">
                  {ideaBatchRows.map((row, index) => {
                    const previewRow = ideaBatchPreview[index];
                    return (
                      <div key={`${row.category}-${row.title}-${index}`} className="grid gap-2 rounded border bg-white p-2 md:grid-cols-[minmax(160px,1.3fr)_minmax(130px,1fr)_100px_100px_90px_auto]">
                        <input aria-label={`Product title ${index + 1}`} value={row.title} onChange={event=>updateIdeaBatchRow(index, { title: event.target.value })} className="min-w-0 rounded border p-2 text-sm" />
                        <select aria-label={`Category ${index + 1}`} value={row.category} onChange={event=>updateIdeaBatchRow(index, { category: event.target.value })} className="min-w-0 rounded border p-2 text-sm">
                          {!categories.some(category => category.name === row.category) && <option value={row.category}>{row.category}</option>}
                          {categories.map(category => <option key={category._id || category.id} value={category.name}>{category.name}</option>)}
                        </select>
                        <input aria-label={`Selling price ${index + 1}`} type="number" min="0.01" step="0.01" placeholder="Price*" value={row.price} onChange={event=>updateIdeaBatchRow(index, { price: event.target.value === '' ? '' : Number(event.target.value) })} className="min-w-0 rounded border p-2 text-sm" />
                        <input aria-label={`Original price ${index + 1}`} type="number" min="0" step="0.01" placeholder="Original price" value={row.originalPrice} onChange={event=>updateIdeaBatchRow(index, { originalPrice: event.target.value === '' ? '' : Number(event.target.value) })} className="min-w-0 rounded border p-2 text-sm" />
                        <input aria-label={`Stock ${index + 1}`} type="number" min="0" step="1" placeholder="Stock" value={row.stock} onChange={event=>updateIdeaBatchRow(index, { stock: Number(event.target.value) })} className="min-w-0 rounded border p-2 text-sm" />
                        <button type="button" onClick={()=>{ setIdeaBatchRows(previous=>previous.filter((_, rowIndex)=>rowIndex !== index)); setIdeaBatchPreview([]); }} className="rounded px-2 text-sm text-red-700">Remove</button>
                        {previewRow?.errors?.length > 0 && <p className="md:col-span-full text-xs text-red-700">{previewRow.errors.join(', ')}</p>}
                        {previewRow?.duplicate && <div className="md:col-span-full flex flex-wrap items-center gap-2 text-xs text-amber-800">
                          <span>Similar existing product: {previewRow.duplicate.title} ({previewRow.duplicate.category})</span>
                          <select value={ideaBatchDecisions[String(previewRow.rowNumber)] || 'skip'} onChange={event=>setIdeaBatchDecisions(previous=>({ ...previous, [String(previewRow.rowNumber)]: event.target.value }))} className="rounded border p-1">
                            <option value="skip">Skip existing</option>
                            <option value="update">Update existing</option>
                          </select>
                        </div>}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={previewIdeaBatch} disabled={ideaBatchBusy} className="rounded border px-4 py-2 text-sm disabled:opacity-60">{ideaBatchBusy ? 'Checking…' : 'Preview batch'}</button>
                  {ideaBatchPreview.length > 0 && <button type="button" onClick={createIdeaBatch} disabled={ideaBatchBusy || ideaBatchPreview.some(row=>row.errors?.length)} className="rounded bg-emerald-700 px-4 py-2 text-sm text-white disabled:opacity-50">{ideaBatchBusy ? 'Saving…' : `Create batch (${ideaBatchPreview.filter(row=>!row.duplicate || ideaBatchDecisions[String(row.rowNumber)] !== 'skip').length})`}</button>}
                </div>
              </section>
            )}
            {ideaQuery.trim() && productIdeas.length === 0 && <p className="mt-3 text-sm text-gray-500">Type a product name to see ideas.</p>}
          </section>

          <div className="grid md:grid-cols-2 gap-6">
            <div ref={productFormRef} className="bg-white p-4 rounded shadow scroll-mt-4">
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
                  {((typeof form.featuredImage === 'object' ? form.featuredImage.url : form.featuredImage) || (typeof form.image === 'object' ? form.image.url : form.image)) && (
                    <div className="mt-2"><img src={(typeof form.featuredImage === 'object' ? form.featuredImage.url : form.featuredImage) || (typeof form.image === 'object' ? form.image.url : form.image)} alt="featured" className="h-24 object-contain" /></div>
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
                  <label className="flex items-center gap-2"><input type="checkbox" checked={form.isNewArrival} onChange={e=>setForm(f=>({...f, isNewArrival: e.target.checked}))} /> New Arrival</label>
                </div>

                <div className="flex gap-2">
                  <button disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-60" type="submit">{saving ? (editingId ? 'Saving...' : 'Creating...') : (editingId ? 'Save changes' : 'Create product')}</button>
                  {editingId && <button type="button" onClick={()=>{ setEditingId(null); setForm({ title: '', price: '', sku: '', category: '', stock: 9999, description: '', images: [], featuredImage: '', featured: false, isNewArrival: false }); }} className="px-3 py-2 border rounded">Cancel</button>}
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
                      <div className="font-medium">{p.title} {p.featured ? <span className="ml-2 inline-flex items-center rounded bg-yellow-100 px-2 py-0.5 text-xs font-semibold text-yellow-800">Featured</span> : null} {p.isNewArrival ? <span className="ml-2 inline-flex items-center rounded bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">New</span> : null}</div>
                      <div className="text-sm text-gray-600">
                        SKU: {p.sku || '—'} • Price: ₹{Number(p.price||0).toFixed(2)} • Category: {(() => {
                          const cat = categories.find(c => String(c._id || c.id) === String(p.category) || (c.name || c.title || '') === String(p.category));
                          return cat ? (cat.name || cat.title || String(p.category)) : (p.category || '—');
                        })()}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">Stock: {p.stock || 0} • {p.onSale ? `Sale ₹${Number(p.salePrice||0).toFixed(2)}` : 'Regular price'}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={()=>{ setEditingId(p._id); setForm({ ...p, price: p.price, originalPrice: p.originalPrice, salePrice: p.salePrice, sku: (p.sku||'').toUpperCase(), category: p.category || '', featured: !!p.featured, isNewArrival: !!p.isNewArrival, _prev: p }); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="px-2 py-1 border rounded">Edit</button>
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
  if(!session || session.user?.role !== 'admin') return authRedirect(ctx);
  // Don't serialize the full product list into the page HTML — fetch client-side to avoid large page data.
  // This reduces initial page payload and prevents Next.js large page data warnings.
  await dbConnect();
  return { props: {} };
}