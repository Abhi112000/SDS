import fs from 'fs';
import path from 'path';
import dbConnect from '@/lib/dbConnect';
import Product from '@/models/Product';
import Link from 'next/link';
import { useState, useContext } from 'react';
import Head from 'next/head';
import { CartContext } from '../../components/CartContext';

export default function ProductPage({ product }){
  const { add } = useContext(CartContext);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  if(!product) return (
    <main className="max-w-4xl mx-auto py-12">
      <div className="card">Product not found</div>
    </main>
  );

  const price = typeof product.price === 'number' ? product.price : Number(product.price || 0);

  function addToCart(){
    add({ _id: product._id || product.sku || product.id, title: product.title || product.name, price, image: product.image || (product.images && product.images[0]) });
    setAdded(true);
    setTimeout(()=>setAdded(false), 2000);
  }

  return (
    <main className="max-w-7xl mx-auto py-12 px-4">
      <Head>
        <title>{product.title || product.name} — Shree Durga Stationary</title>
      </Head>

      <div className="grid md:grid-cols-2 gap-8 items-start">
        <div className="card p-6">
          <img src={product.image || (product.images && product.images[0]) || '/images/sample1.svg'} alt={product.title || product.name} className="w-full object-contain max-h-96" />
        </div>

        <div>
          <h1 className="text-2xl font-extrabold mb-2 text-primary">{product.title || product.name}</h1>
          <div className="text-lg mb-4 text-muted">{product.subtitle || product.category || ''}</div>

          <div className="mb-4">
            {product.originalPrice && product.originalPrice > price ? (
              <div className="flex items-center gap-3">
                <div className="text-sm line-through text-gray-500">₹{product.originalPrice}</div>
                <div className="text-2xl font-bold text-primary">₹{price}</div>
              </div>
            ) : (
              <div className="text-2xl font-bold text-primary">₹{price}</div>
            )}
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
