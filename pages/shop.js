import Link from "next/link";
import Breadcrumbs from '../components/Breadcrumbs';
import { useRouter } from 'next/router';
import ProductCard from "../components/ProductCard";
import dbConnect from '@/lib/dbConnect';
import Product from '@/models/Product';
import Category from '@/models/Category';
import { useEffect, useState } from 'react';

export default function Shop({ products = [], categories = [], q = '', category = '' }) {
  const router = useRouter();
  const [search, setSearch] = useState(q || '');
  const [cat, setCat] = useState(category || '');

  function submitFilter(e){
    e && e.preventDefault();
    const params = new URLSearchParams();
    if(search) params.set('q', search);
    if(cat) params.set('category', cat);
    const qs = params.toString();
    router.push('/shop' + (qs ? ('?' + qs) : ''));
  }

  return (
    <main className="max-w-7xl mx-auto px-4 py-10">
      <Breadcrumbs items={[{ label: 'Shop' }]} />
      <button onClick={() => router.back()} className="mb-4 px-4 py-2 btn-secondary rounded">Back</button>
      <h1 className="text-3xl font-bold text-gray-800 mb-4">Our Products</h1>

      <form onSubmit={submitFilter} className="flex gap-2 items-center mb-6">
        <input placeholder="Search products" value={search} onChange={e=>setSearch(e.target.value)} className="p-2 border rounded flex-1" />
        <select value={cat} onChange={e=>{ setCat(e.target.value); const params = new URLSearchParams(); if(search) params.set('q', search); if(e.target.value) params.set('category', e.target.value); router.push('/shop' + (params.toString() ? ('?' + params.toString()) : '')); }} className="p-2 border rounded">
          <option value="">All categories</option>
          {categories.map(c => <option key={c._id} value={c.name}>{c.name}</option>)}
        </select>
        <button className="px-3 py-2 bg-blue-600 text-white rounded">Search</button>
      </form>

      <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {products.map((product) => (
          <div key={product._id}>
            <ProductCard product={product} />
          </div>
        ))}
      </div>

      <div className="text-center mt-10">
        <Link
          href="/contact"
          className="inline-block px-6 py-3 rounded-lg btn-primary"
        >
          Need Help? Contact Us
        </Link>
      </div>
    </main>
  );
}

export async function getServerSideProps(ctx){
  await dbConnect();
  const { q, category } = ctx.query || {};
  const filter = {};
  if(category) filter.category = category;
  if(q) filter.title = { $regex: q, $options: 'i' };
  const products = await Product.find(filter).lean();
  const categories = [];
  try{ const CategoryModel = (await import('@/models/Category')).default; const cats = await CategoryModel.find({}).sort({ name: 1 }).lean(); categories.push(...cats); }catch(e){}
  return { props: { products: JSON.parse(JSON.stringify(products || [])), categories: JSON.parse(JSON.stringify(categories || [])), q: q || '', category: category || '' } };
}
