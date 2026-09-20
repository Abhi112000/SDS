import Link from "next/link";
import Breadcrumbs from '../components/Breadcrumbs';
import { useRouter } from 'next/router';
import ProductCard from "../components/ProductCard";
import dbConnect from '@/lib/dbConnect';
import Product from '@/models/Product';
import Category from '@/models/Category';
import { useSession } from 'next-auth/react';
import { useEffect, useMemo, useRef, useState } from 'react';

export default function Shop({ products = [], categories = [], q = '', category = '' }) {
  const router = useRouter();
  const { data: session } = useSession();
  const resultsRef = useRef(null);
  const pageSize = 20;
  const [search, setSearch] = useState(q || '');
  const [page, setPage] = useState(1);
  const [selectedCats, setSelectedCats] = useState(() => {
    if (Array.isArray(category)) return category;
    return category ? [category] : [];
  });
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

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

  async function recordVisitorActivity(action, payload = {}) {
    if (typeof window === 'undefined') return;
    const sessionId = window.localStorage.getItem('sd_visitor_session');
    if (!sessionId) return;
    if (session?.user?.role === 'admin') return;

    try {
      await fetch('/api/visitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          action,
          page: '/shop',
          title: payload.title || 'Shop',
          deviceType: window.innerWidth < 768 ? 'phone' : (window.innerWidth < 1024 ? 'tablet' : 'desktop'),
          userAgent: navigator.userAgent || '',
          userId: session?.user?.id || null,
          userName: session?.user?.name || '',
          email: session?.user?.email || '',
          searchTerm: payload.searchTerm || '',
          resultCount: typeof payload.resultCount === 'number' ? payload.resultCount : null,
          category: payload.category || '',
          productId: payload.productId || '',
          productTitle: payload.productTitle || ''
        })
      });
    } catch (e) {
      // ignore tracking errors
    }
  }

  function submitFilter(e){
    e && e.preventDefault();
    setPage(1);
    const term = (search || '').trim();
    recordVisitorActivity('search', {
      title: term ? `Search: ${term}` : 'Shop search',
      searchTerm: term,
      resultCount: term ? displayProducts.length : products.length,
      category: selectedCats.join(',')
    });
  }

  function scrollToResults(){
    if (!resultsRef.current || typeof window === 'undefined') return;
    const top = resultsRef.current.getBoundingClientRect().top + window.pageYOffset - 90;
    window.scrollTo({ top, behavior: 'smooth' });
  }

  function toggleCategory(catName){
    setPage(1);
    const current = selectedCats || [];
    const relatedNames = getRelatedCategoryNames(catName);
    const next = current.includes(catName) ? current.filter((c) => !relatedNames.includes(c)) : Array.from(new Set([...current, ...relatedNames]));
    setSelectedCats(next);
    recordVisitorActivity('category-click', {
      title: `Category: ${catName}`,
      category: catName,
      resultCount: next.length === 0 ? products.length : products.filter((product) => {
        const productCategory = String(product.category || '');
        return (next.length === 0 || next.includes(productCategory));
      }).length
    });
    setTimeout(() => scrollToResults(), 80);
  }

  function clearCategories(){
    setPage(1);
    setSelectedCats([]);
    setMobileFilterOpen(false);
  }

  function goToPage(nextPage) {
    const next = Math.max(1, Math.min(nextPage, pageCount));
    setPage(next);
    setTimeout(() => scrollToResults(), 60);
  }

  const categoryMap = new Map((categories || []).map((c) => [String(c._id || c.id), c]));
  const childrenByParent = categories.reduce((acc, c) => {
    const parentId = c.parentId ? String(c.parentId) : null;
    if (!parentId) return acc;
    const parentList = acc.get(parentId) || [];
    parentList.push(c);
    acc.set(parentId, parentList);
    return acc;
  }, new Map());
  const rootCategories = (categories || []).filter((c) => !c.parentId);
  const [expandedCats, setExpandedCats] = useState({});

  function toggleExpanded(catId) {
    setExpandedCats((prev) => ({ ...prev, [catId]: !prev[catId] }));
  }

  function getRelatedCategoryNames(catName) {
    const categoryDoc = (categories || []).find((c) => (c.name || c.title || '') === catName);
    if (!categoryDoc) return [catName];
    const related = new Set([catName]);
    const childList = childrenByParent.get(String(categoryDoc._id || categoryDoc.id)) || [];
    childList.forEach((child) => related.add(child.name || child.title || ''));
    return Array.from(related).filter(Boolean);
  }

  function categoryButtonsForList(list) {
    return list.map((c) => {
      const catName = c.name || c.title || '';
      const catId = String(c._id || c.id || catName);
      const children = childrenByParent.get(catId) || [];
      const isExpanded = !!expandedCats[catId];
      const hasChildren = children.length > 0;
      const checked = selectedCats.includes(catName) || (hasChildren && children.some((child) => selectedCats.includes(child.name || child.title || '')));

      return (
        <div key={catId} className="space-y-1">
          <div className="flex items-center gap-1.5">
            {hasChildren ? (
              <button type="button" onClick={() => toggleExpanded(catId)} className="flex h-5 w-5 items-center justify-center rounded border border-slate-200 bg-slate-50 text-xs text-slate-600 hover:border-primary hover:text-primary">
                {isExpanded ? '−' : '+'}
              </button>
            ) : (
              <span className="h-5 w-5" />
            )}
            <button type="button" aria-pressed={checked} onClick={() => toggleCategory(catName)} className={`flex-1 text-left rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${checked ? 'bg-primary text-white border-primary shadow-sm' : 'bg-white text-slate-700 border-slate-200 hover:border-primary hover:text-primary'}`}>{catName}</button>
          </div>
          {hasChildren && isExpanded && (
            <div className="ml-6 space-y-1 border-l border-slate-200 pl-2">
              {children.map((child) => {
                const childName = child.name || child.title || '';
                const childChecked = selectedCats.includes(childName);
                return (
                  <button key={String(child._id || child.id || childName)} type="button" aria-pressed={childChecked} onClick={() => toggleCategory(childName)} className={`w-full text-left rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition ${childChecked ? 'bg-primary text-white border-primary shadow-sm' : 'bg-white text-slate-700 border-slate-200 hover:border-primary hover:text-primary'}`}>{childName}</button>
                );
              })}
            </div>
          )}
        </div>
      );
    });
  }

  const categoryButtons = (
    <div className="space-y-1.5">
      <button type="button" aria-pressed={selectedCats.length === 0} onClick={clearCategories} className={`w-full text-left rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${selectedCats.length === 0 ? 'bg-primary text-white border-primary shadow-sm' : 'bg-white text-slate-700 border-slate-200 hover:border-primary hover:text-primary'}`}>All products</button>
      {categoryButtonsForList(rootCategories)}
    </div>
  );

  return (
    <main className="max-w-7xl mx-auto px-3 py-3 md:px-4 md:py-4">
      <Breadcrumbs items={[{ label: 'Shop' }]} />
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3 md:mb-4">
        <div>
          <div className="page-section-kicker text-[10px] md:text-xs">Storefront</div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mt-1">Our Products</h1>
        </div>
        <button onClick={() => router.back()} className="mb-1 px-3 py-1.5 btn-secondary rounded text-sm">Back</button>
      </div>

      <section className="form-panel p-2.5 md:p-3 mb-3 md:mb-4">
        <form onSubmit={submitFilter} className="flex flex-col gap-3 md:gap-3">
          <div className="flex flex-col md:flex-row gap-2.5 items-stretch md:items-center">
            <label className="sr-only" htmlFor="product-search">Search products</label>
            <div className="relative flex-1 min-w-[210px]">
              <input id="product-search" placeholder="Search products" value={search} onChange={(e)=>{ setSearch(e.target.value); setPage(1); setShowSuggestions(true); }} onFocus={()=>setShowSuggestions(true)} onBlur={()=>setTimeout(()=>setShowSuggestions(false), 120)} className="form-field w-full text-sm py-2.5" />
              {showSuggestions && suggestionItems.length > 0 && (
                <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-white border rounded shadow-xl max-h-72 overflow-auto">
                  {suggestionItems.map((item) => (
                    <button key={item._id} type="button" onMouseDown={(e)=>e.preventDefault()} onClick={() => { setSearch(item.title || item.name || ''); setShowSuggestions(false); setPage(1); }} className="w-full text-left px-4 py-2 hover:bg-slate-50 border-b last:border-b-0">
                      <div className="font-medium text-sm text-slate-800">{item.title || item.name}</div>
                      {item.category && <div className="text-[11px] text-slate-500">{item.category}</div>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button className="px-3 py-2.5 btn-primary rounded-lg min-w-[110px] text-sm">Search</button>
          </div>

          <div className="flex items-center justify-between gap-2 md:gap-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-2 w-2 rounded-full bg-primary"></span>
              <span className="text-[10px] md:text-xs font-black uppercase tracking-[0.2em] text-slate-500">Shop by collection</span>
            </div>
            <div className="flex items-center gap-2">
              {selectedCats.length > 0 && (
                <button type="button" onClick={clearCategories} className="text-[10px] md:text-[11px] font-bold text-primary hover:underline">
                  Clear all
                </button>
              )}
            </div>
          </div>

          <div className={`lg:hidden fixed inset-0 z-40 ${mobileFilterOpen ? 'pointer-events-auto' : 'pointer-events-none'}`} aria-hidden={!mobileFilterOpen}>
            <div className={`absolute inset-0 bg-slate-900/40 transition-opacity ${mobileFilterOpen ? 'opacity-100' : 'opacity-0'}`} onClick={() => setMobileFilterOpen(false)} />
            <aside className={`absolute left-0 top-[12%] h-[88%] w-[60%] max-w-sm bg-white shadow-2xl transform transition-transform duration-200 ${mobileFilterOpen ? 'translate-x-0' : '-translate-x-full'} relative flex flex-col rounded-r-2xl overflow-hidden`}>
              <div className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white px-3 py-2 pr-11 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
                <h2 className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-700">Categories</h2>
                <button type="button" onClick={() => setMobileFilterOpen(false)} className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-lg leading-none text-slate-600 shadow-sm hover:bg-slate-100 hover:text-slate-900" aria-label="Close category panel">×</button>
              </div>
              <div className="flex-1 overflow-y-auto p-2 pb-3 pt-2 space-y-1">
                {categoryButtons}
              </div>
            </aside>
          </div>

          <div className="hidden lg:block">
            {selectedCats.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Selected</span>
                {selectedCats.map((cat) => (
                  <span key={cat} className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold border border-primary/20">
                    {cat}
                    <button type="button" aria-label={`Remove ${cat}`} onClick={() => toggleCategory(cat)} className="text-primary hover:text-red-600 leading-none">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </form>
      </section>

      <div className="lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-5">
        <aside className="hidden lg:block">
          <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm sticky top-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Categories</h2>
            </div>
            {categoryButtons}
          </div>
        </aside>

        <div>
          <div className="mb-3 lg:hidden">
            <button type="button" onClick={() => setMobileFilterOpen(true)} className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 shadow-sm hover:border-primary hover:text-primary">
              Browse Categories
            </button>
          </div>

          {selectedCats.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-2 lg:hidden">
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Selected</span>
              {selectedCats.map((cat) => (
                <span key={cat} className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold border border-primary/20">
                  {cat}
                  <button type="button" aria-label={`Remove ${cat}`} onClick={() => toggleCategory(cat)} className="text-primary hover:text-red-600 leading-none">×</button>
                </span>
              ))}
            </div>
          )}

          <div ref={resultsRef} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {pageProducts.map((product) => (
              <div key={product._id}>
                <ProductCard product={product} />
              </div>
            ))}
          </div>
        </div>
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
