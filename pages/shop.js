import Link from "next/link";
import Breadcrumbs from '../components/Breadcrumbs';
import { useRouter } from 'next/router';
import ProductCard from "../components/ProductCard";
import dbConnect from '@/lib/dbConnect';
import Product from '@/models/Product';
import Category from '@/models/Category';
import { useEffect, useMemo, useRef, useState } from 'react';

export default function Shop({ products = [], categories = [], q = '', category = '' }) {
  const router = useRouter();
  const gridRef = useRef(null);
  const pageSize = 20;
  const [search, setSearch] = useState(q || '');
  const [page, setPage] = useState(1);
  const [selectedCats, setSelectedCats] = useState(() => {
    if (Array.isArray(category)) return category;
    return category ? [category] : [];
  });
  const [showSuggestions, setShowSuggestions] = useState(false);

  const suggestionItems = useMemo(() => {
    const term = (search || '').trim().toLowerCase();
    if (!term) return [];
    return (products || [])
      .filter((p) => {
        const title = String(p.title || p.name || '').toLowerCase();
        const description = String(p.description || '').toLowerCase();
        const sku = String(p.sku || '').toLowerCase();
        return title.includes(term) || description.includes(term) || sku.includes(term);
      })
      .slice(0, 6);
  }, [products, search]);

  const displayProducts = useMemo(() => {
    const term = (search || '').trim().toLowerCase();
    return (products || []).filter((product) => {
      const productCategory = String(product.category || '');
      const catMatches = selectedCats.length === 0 || selectedCats.includes(productCategory);
      if (!catMatches) return false;
      if (!term) return true;

      const title = String(product.title || product.name || '').toLowerCase();
      const description = String(product.description || '').toLowerCase();
      const sku = String(product.sku || '').toLowerCase();
      const categoryName = String(product.category || '').toLowerCase();

      return title.includes(term) || description.includes(term) || sku.includes(term) || categoryName.includes(term);
    });
  }, [products, search, selectedCats]);

  const pageCount = Math.max(1, Math.ceil(displayProducts.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageProducts = displayProducts.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    if (page > pageCount) {
      setPage(pageCount);
    }
  }, [page, pageCount]);

  function submitFilter(e){
    e && e.preventDefault();
    setPage(1);
  }

  function toggleCategory(catName){
    setPage(1);
    setSelectedCats((current) => {
      const next = current.includes(catName)
        ? current.filter((c) => c !== catName)
        : [...current, catName];
      return next;
    });
  }

  function clearCategories(){
    setPage(1);
    setSelectedCats([]);
  }

  function goToPage(nextPage) {
    const next = Math.max(1, Math.min(nextPage, pageCount));
    setPage(next);
    if (gridRef.current) {
      gridRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  return (
    <main className="max-w-7xl mx-auto px-4 py-4">
      <Breadcrumbs items={[{ label: 'Shop' }]} />
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div>
          <div className="page-section-kicker">Storefront</div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mt-2">Our Products</h1>
        </div>
        <button onClick={() => router.back()} className="mb-2 px-4 py-2 btn-secondary rounded">Back</button>
      </div>

      <section className="form-panel p-3 md:p-4 mb-4">
        <form onSubmit={submitFilter} className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
            <label className="sr-only" htmlFor="product-search">Search products</label>
            <div className="relative flex-1 min-w-[210px]">
              <input id="product-search" placeholder="Search products" value={search} onChange={(e)=>{ setSearch(e.target.value); setPage(1); setShowSuggestions(true); }} onFocus={()=>setShowSuggestions(true)} onBlur={()=>setTimeout(()=>setShowSuggestions(false), 120)} className="form-field w-full" />
              {showSuggestions && suggestionItems.length > 0 && (
                <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-white border rounded shadow-xl max-h-80 overflow-auto">
                  {suggestionItems.map((item) => (
                    <button key={item._id} type="button" onMouseDown={(e)=>e.preventDefault()} onClick={() => { setSearch(item.title || item.name || ''); setShowSuggestions(false); setPage(1); }} className="w-full text-left px-4 py-2 hover:bg-slate-50 border-b last:border-b-0">
                      <div className="font-medium text-sm text-slate-800">{item.title || item.name}</div>
                      {item.category && <div className="text-[11px] text-slate-500">{item.category}</div>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button className="px-4 py-3 btn-primary rounded-lg min-w-[130px]">Search</button>
          </div>

          <div className="mt-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-primary"></span>
                <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Shop by collection</span>
              </div>
              {selectedCats.length > 0 && (
                <button type="button" onClick={clearCategories} className="text-xs font-bold text-primary hover:underline">
                  Clear all
                </button>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button type="button" aria-pressed={selectedCats.length === 0} onClick={clearCategories} className={`category-chip ${selectedCats.length === 0 ? 'is-selected' : ''}`}>All products</button>
              {categories.map((c) => {
                const catName = c.name || c.title || '';
                const checked = selectedCats.includes(catName);
                return (
                  <button key={c._id || c.id} type="button" aria-pressed={checked} onClick={() => toggleCategory(catName)} className={`category-chip ${checked ? 'is-selected' : ''}`}>{catName}</button>
                );
              })}
            </div>

            {selectedCats.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Selected</span>
                {selectedCats.map((cat) => (
                  <span key={cat} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold border border-primary/20">
                    {cat}
                    <button type="button" aria-label={`Remove ${cat}`} onClick={() => toggleCategory(cat)} className="text-primary hover:text-red-600 leading-none">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </form>
      </section>

      <div ref={gridRef} className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {pageProducts.map((product) => (
          <div key={product._id}>
            <ProductCard product={product} />
          </div>
        ))}
      </div>

      {displayProducts.length > pageSize && (
        <nav className="mt-8 flex flex-wrap items-center justify-center gap-2">
          <button type="button" onClick={() => goToPage(Math.max(1, safePage - 1))} disabled={safePage === 1} className="pagination-button">Prev</button>
          {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
            <button type="button" key={n} onClick={() => goToPage(n)} className={`pagination-button ${safePage === n ? 'is-active' : ''}`}>{n}</button>
          ))}
          <button type="button" onClick={() => goToPage(Math.min(pageCount, safePage + 1))} disabled={safePage === pageCount} className="pagination-button">Next</button>
        </nav>
      )}

      <div className="text-center mt-10">
        <Link
          href="/contact"
          className="inline-flex px-6 py-3 rounded-lg btn-primary"
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

  const categories = [];
  try{ const CategoryModel = (await import('@/models/Category')).default; const cats = await CategoryModel.find({}).sort({ name: 1 }).lean(); categories.push(...cats); }catch(e){}

  const requestedCategories = Array.isArray(category) ? category : (category ? [category] : []);
  if(requestedCategories.length) {
    const escapedCats = requestedCategories.map((c) => String(c).trim());
    const categoryNames = [];
    const categoryIds = [];
    for (const raw of escapedCats) {
      const categoryByName = categories.find(c => String(c.name || '').toLowerCase() === raw.toLowerCase());
      const categoryById = categories.find(c => String(c._id || c.id) === String(raw));
      if(categoryByName){ categoryNames.push(categoryByName.name); categoryIds.push(String(categoryByName._id || categoryByName.id)); }
      if(categoryById){ categoryNames.push(categoryById.name); categoryIds.push(String(categoryById._id || categoryById.id)); }
    }
    const cats = Array.from(new Set([ ...categoryNames, ...categoryIds, ...escapedCats ]));
    const categoryFilter = cats.map((entry) => ({ category: { $regex: new RegExp(`^${String(entry).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } }));
    filter.$or = categoryFilter;
  }

  if(q) {
    const searchTerm = String(q).trim();
    const regex = { $regex: new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') };
    const baseQuery = [
      { title: regex },
      { description: regex },
      { sku: regex },
      { category: regex }
    ];
    if(filter.$or){
      filter.$and = [ { $or: filter.$or }, { $or: baseQuery } ];
      delete filter.$or;
    } else {
      filter.$or = baseQuery;
    }
  }

  const products = await Product.find(filter).lean();
  const categoryNameById = new Map((categories || []).map(c => [String(c._id || c.id), c.name || c.title || '']));
  const normalizedProducts = (products || []).map((product) => {
    const productCategory = String(product.category || '').trim();
    if(productCategory && categoryNameById.has(productCategory)) {
      return { ...product, category: categoryNameById.get(productCategory) };
    }
    return product;
  });
  return { props: { products: JSON.parse(JSON.stringify(normalizedProducts)), categories: JSON.parse(JSON.stringify(categories || [])), q: q || '', category: requestedCategories } };
}
