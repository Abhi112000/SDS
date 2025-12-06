import fs from 'fs';
import path from 'path';
import dbConnect from '@/lib/dbConnect';
import Product from '@/models/Product';
import Link from 'next/link';
import { useState, useContext, useEffect, useRef } from 'react';
import Head from 'next/head';
import { CartContext } from '../../components/CartContext';

export default function ProductPage({ product }){
  const { add } = useContext(CartContext);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);

  if(!product) return (
    <main className="max-w-4xl mx-auto py-12">
      <div className="card">Product not found</div>
    </main>
  );

  const price = typeof product.price === 'number' ? product.price : Number(product.price || 0);

  function addToCart(){
    const imgForCart = pickSize(product.image, 'card') || pickSize(product.images && product.images[0], 'card') || null;
    const effectivePrice = ((product.onSale || (product.tags && product.tags.includes && product.tags.includes('SALE!'))) && product.salePrice) ? Number(product.salePrice) : price;
    add({ _id: product._id || product.sku || product.id, title: product.title || product.name, price: effectivePrice, image: imgForCart }, Number(qty || 1));
    setAdded(true);
    setTimeout(()=>setAdded(false), 2000);
  }

  const imgs = [product.image, ...(product.images || [])].filter(Boolean).filter((v,i,a)=> a.indexOf(v) === i);

  function pickSize(item, size){
    if(!item) return null;
    if(typeof item === 'string') return item;
    if(typeof item === 'object') return item.url || item[size] || item.card || item.large || item.thumb || null;
    return null;
  }

  function openGalleryAt(idx){ setGalleryIndex(idx); setShowGallery(true); }

  // keyboard navigation for modal
  useEffect(()=>{
    if(!showGallery) return;
    function onKey(e){
      if(e.key === 'Escape') setShowGallery(false);
      else if(e.key === 'ArrowLeft') setGalleryIndex(i=> (i - 1 + imgs.length) % imgs.length);
      else if(e.key === 'ArrowRight') setGalleryIndex(i=> (i + 1) % imgs.length);
    }
    window.addEventListener('keydown', onKey);
    return ()=> window.removeEventListener('keydown', onKey);
  }, [showGallery, imgs.length]);

  // swipe support
  const touchStartX = useRef(null);
  function onTouchStart(e){ touchStartX.current = e.touches && e.touches[0] && e.touches[0].clientX; }
  function onTouchEnd(e){
    if(touchStartX.current == null) return;
    const x = (e.changedTouches && e.changedTouches[0] && e.changedTouches[0].clientX) || 0;
    const dx = x - touchStartX.current;
    if(Math.abs(dx) > 50){
      if(dx > 0) setGalleryIndex(i=> (i - 1 + imgs.length) % imgs.length);
      else setGalleryIndex(i=> (i + 1) % imgs.length);
    }
    touchStartX.current = null;
  }

  return (
    <main className="max-w-7xl mx-auto py-12 px-4">
      <Head>
        <title>{`${product.title || product.name} — Shree Durga Stationary`}</title>
      </Head>

      <div className="grid md:grid-cols-2 gap-8 items-start">
        <div className="card p-6">
          {(() => {
            const main = pickSize(imgs[0], 'large') || pickSize(imgs[0], 'card') || '/images/sample1.svg';
            const thumb0 = pickSize(imgs[0], 'thumb') || pickSize(imgs[0], 'card') || main;
            const srcSet = `${thumb0 ? `${thumb0} 200w,` : ''} ${main ? `${main} 1200w` : ''}`;
            return <img src={main} srcSet={srcSet} sizes="(max-width:640px) 100vw, 50vw" loading="lazy" alt={product.title || product.name} className="w-full object-contain max-h-96" onError={(e)=>{ e.currentTarget.onerror = null; e.currentTarget.src = '/images/sample1.svg'; e.currentTarget.srcset = ''; }} />;
          })()}
          {imgs.length > 1 && (
            <div className="flex gap-2 mt-3">
              {imgs.map((item,i)=> {
                const t = pickSize(item, 'thumb') || pickSize(item, 'card') || pickSize(item, 'large');
                return (
                  <button key={i} onClick={()=>openGalleryAt(i)} className="border rounded p-0.5">
                    <img src={t} className="w-16 h-16 object-cover rounded" onError={(e)=>{ e.currentTarget.onerror = null; e.currentTarget.src = '/images/sample1.svg'; }} />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <h1 className="text-2xl font-extrabold mb-2 text-primary">{product.title || product.name}</h1>
          <div className="text-lg mb-4 text-muted">{product.subtitle || product.category || ''}</div>

          <div className="mb-4">
            {((product.onSale || (product.tags && product.tags.includes && product.tags.includes('SALE!'))) && product.salePrice) ? (
              <div className="flex items-center gap-3">
                <div className="text-sm line-through text-gray-500">₹{price}</div>
                <div className="text-2xl font-bold text-primary">₹{product.salePrice}</div>
              </div>
            ) : (product.originalPrice && product.originalPrice > price ? (
              <div className="flex items-center gap-3">
                <div className="text-sm line-through text-gray-500">₹{product.originalPrice}</div>
                <div className="text-2xl font-bold text-primary">₹{price}</div>
              </div>
            ) : (
              <div className="text-2xl font-bold text-primary">₹{price}</div>
            ))}
          </div>

          <div className="mb-4 text-sm text-muted">
            {product.description || 'No description available.'}
          </div>

          <div className="flex items-center gap-3 mb-4">
            <label className="text-sm">Qty</label>
            <input type="number" min="1" value={qty} onChange={(e)=>setQty(Math.max(1, Number(e.target.value || 1)))} className="w-20 px-2 py-1 border rounded" />
            <button onClick={addToCart} className="px-4 py-2 rounded-md btn-primary">Add to Cart</button>
            <button onClick={()=>{ addToCart(); window.location='/cart'; }} className="px-4 py-2 rounded-md btn-ghost">Buy Now</button>
          </div>

          {added && <div className="text-sm text-primary mb-4">Added to cart</div>}

          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-2">Details</h3>
            <div className="text-sm text-muted">{product.longDescription || product.description || '—'}</div>
          </div>

          <div className="mt-6">
            <Link href="/shop" className="underline">Back to shop</Link>
          </div>
        </div>
      </div>
      {showGallery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75">
          <div className="relative max-w-4xl w-full mx-4">
            <button onClick={()=>setShowGallery(false)} className="absolute top-2 right-2 text-white bg-black bg-opacity-50 rounded px-3 py-1">Close</button>
            <div className="flex items-center">
              <button onClick={()=>setGalleryIndex(i=> (i - 1 + imgs.length) % imgs.length)} className="text-white px-3">◀</button>
              <div className="flex-1 text-center">
                {(() => {
                  const item = imgs[galleryIndex];
                  const large = pickSize(item, 'large') || pickSize(item, 'card') || pickSize(item, 'thumb');
                  const card = pickSize(item, 'card') || pickSize(item, 'thumb') || large;
                  const thumb = pickSize(item, 'thumb') || card;
                  const srcSet = `${thumb ? `${thumb} 200w,` : ''} ${card ? `${card} 600w,` : ''} ${large ? `${large} 1200w` : ''}`;
                  return (
                    <img src={card || large} srcSet={srcSet} sizes="(max-width: 800px) 100vw, 800px" className="max-h-[70vh] w-auto mx-auto" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} loading="lazy" />
                  );
                })()}
              </div>
              <button onClick={()=>setGalleryIndex(i=> (i + 1) % imgs.length)} className="text-white px-3">▶</button>
            </div>
            {imgs.length > 1 && (
              <div className="flex gap-2 mt-3 justify-center">
                {imgs.map((s, idx)=> (
                  <button key={idx} onClick={()=>setGalleryIndex(idx)} className={`border ${idx===galleryIndex? 'ring-2 ring-white' : ''}`}>
                    <img src={pickSize(s, 'thumb') || pickSize(s, 'card') || pickSize(s, 'large') || ''} className="w-16 h-16 object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

export async function getStaticPaths(){
  const p = path.join(process.cwd(), 'data', 'sample_products.json');
  let products = [];
  try{ products = JSON.parse(fs.readFileSync(p,'utf8')); }catch(e){ products = []; }
  const paths = (products||[]).map(prod=>({ params: { id: (prod._id || prod.sku || (prod.title||prod.name||'').replace(/\s+/g,'-').toLowerCase()) } }));
  return { paths, fallback: 'blocking' };
}

export async function getStaticProps({ params }){
  const { id } = params;
  const p = path.join(process.cwd(), 'data', 'sample_products.json');
  let products = [];
  try{ products = JSON.parse(fs.readFileSync(p,'utf8')); }catch(e){ products = []; }
  let product = (products||[]).find(prod => (prod._id === id) || (prod.sku === id) || ((prod.title||prod.name||'').replace(/\s+/g,'-').toLowerCase() === id));

  // If not found in sample data, try the database (for runtime products)
  if(!product){
    try{
      await dbConnect();
      // Try by ObjectId (_id) or sku
      const byId = await Product.findById(id).lean().exec().catch(()=>null);
      if(byId) product = JSON.parse(JSON.stringify(byId));
      else {
        const bySku = await Product.findOne({ sku: id }).lean().exec().catch(()=>null);
        if(bySku) product = JSON.parse(JSON.stringify(bySku));
      }
    }catch(e){ /* ignore DB errors and fall through to 404 */ }
  }

  if(!product) return { notFound: true };
  return { props: { product }, revalidate: 10 };
}
