import Link from "next/link";
import ProductCard from "../components/ProductCard";
import dbConnect from '@/lib/mongodb';
import Product from '@/models/Product';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/router';
import useFocusTrap from '../hooks/useFocusTrap';
import { getFuzzyMatchScore } from '@/lib/searchMatching';

const quickReachItems = [
  { category: 'Gifts', icon: '✳', tone: 'home-category-pink', note: 'Little surprises' },
  { category: 'Notebooks', icon: '▤', tone: 'home-category-yellow', note: 'Ideas start here' },
  { category: 'Pens', icon: '✎', tone: 'home-category-blue', note: 'Make your mark' },
  { category: 'Office Supplies', icon: '▧', tone: 'home-category-lilac', note: 'Ready for work' }
];

const searchablePages = [
  { title: 'Shop all products', subtitle: 'Browse the full collection', href: '/shop', keywords: ['shop', 'products', 'buy', 'store', 'browse'] },
  { title: 'Shopping cart', subtitle: 'View items in your bag', href: '/cart', keywords: ['cart', 'bag', 'basket'] },
  { title: 'Contact us', subtitle: 'Get in touch with the store', href: '/contact', keywords: ['contact', 'help', 'support', 'address', 'phone'] }
];

function getImage(product) {
  const image = product?.image || product?.images?.[0];
  const url = typeof image === 'string' ? image : image?.card || image?.large || image?.url || image?.thumb || null;
  return typeof url === 'string' && !/\/images\/sample\d*\.svg(?:$|[?#])/i.test(url) ? url : null;
}

function ProductArtwork({ products }) {
  const featured = products.slice(0, 3);
  if (!featured.length) {
    return (
      <div className="home-art-empty" aria-hidden="true">
        <div className="home-art-orbit" />
        <div className="home-art-notebook"><span /></div>
        <div className="home-art-pencil" />
        <div className="home-art-paper"><i /><i /><i /></div>
        <span className="home-art-spark home-art-spark-one">✦</span>
        <span className="home-art-spark home-art-spark-two">✳</span>
      </div>
    );
  }

  return (
    <div className="home-product-art" aria-label="Featured stationery picks">
      <div className="home-product-art-glow" />
      {featured.map((product, index) => (
        <Link
          key={product._id || product.sku || index}
          href={`/product/${product._id || product.sku}`}
          className={`home-art-product home-art-product-${index + 1}`}
          aria-label={`Shop ${product.title || product.name || 'featured product'}`}
        >
          <img src={getImage(product)} alt="" />
          {index === 0 && <span className="home-art-tag">Good things for every day</span>}
        </Link>
      ))}
      <span className="home-art-sticker" aria-hidden="true">Make<br />something</span>
      <span className="home-art-doodle home-art-doodle-one" aria-hidden="true">✦</span>
      <span className="home-art-doodle home-art-doodle-two" aria-hidden="true">✳</span>
    </div>
  );
}

export default function Home({ products = [], saleProducts = [], newArrivals = [] }) {
  const [slides, setSlides] = useState([]);
  const [activeSlide, setActiveSlide] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState({ products: [], categories: [] });
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState('');
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const router = useRouter();
  const searchTriggerRef = useRef(null);
  const searchDialogRef = useRef(null);
  const searchInputRef = useRef(null);
  const wasSearchOpenRef = useRef(false);
  useFocusTrap(searchDialogRef, searchOpen);
  const matchingPages = useMemo(() => {
    if (searchQuery.trim().length < 2) return [];
    return searchablePages
      .map(page => ({
        ...page,
        fuzzy: ![page.title, ...page.keywords].some(value =>
          value.toLowerCase().includes(searchQuery.trim().toLowerCase())
        ) && getFuzzyMatchScore(searchQuery, page.title, ...page.keywords) !== null
      }))
      .filter(page => [page.title, ...page.keywords].some(value =>
        value.toLowerCase().includes(searchQuery.trim().toLowerCase())
      ) || page.fuzzy);
  }, [searchQuery]);
  const suggestionLinks = useMemo(() => [
    ...suggestions.products.map(product => ({ ...product, kind: 'product', href: `/product/${product.id}` })),
    ...suggestions.categories.map(category => ({ ...category, kind: 'category', title: category.name })),
    ...matchingPages.map(page => ({ ...page, kind: 'page' }))
  ], [suggestions, matchingPages]);

  function closeSearch() {
    setSearchOpen(false);
    window.requestAnimationFrame(() => searchTriggerRef.current?.focus());
  }

  function getSuggestionImage(image) {
    const url = typeof image === 'string'
      ? image
      : (image && typeof image === 'object' ? image.thumb || image.card || image.url || image.large || null : null);
    return typeof url === 'string' && !/\/images\/sample\d*\.svg(?:$|[?#])/i.test(url) ? url : null;
  }

  function handleSearchKeyDown(event) {
    if (event.key === 'ArrowDown' && suggestionLinks.length) {
      event.preventDefault();
      setActiveSuggestion(index => (index + 1) % suggestionLinks.length);
    } else if (event.key === 'ArrowUp' && suggestionLinks.length) {
      event.preventDefault();
      setActiveSuggestion(index => (index <= 0 ? suggestionLinks.length - 1 : index - 1));
    } else if (event.key === 'Enter' && activeSuggestion >= 0 && suggestionLinks[activeSuggestion]) {
      event.preventDefault();
      const { href } = suggestionLinks[activeSuggestion];
      closeSearch();
      router.push(href);
    }
  }

  useEffect(() => {
    if (searchOpen) {
      wasSearchOpenRef.current = true;
      searchInputRef.current?.focus();
    } else if (wasSearchOpenRef.current) {
      wasSearchOpenRef.current = false;
      searchTriggerRef.current?.focus();
    }
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeSearch();
      }
    };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [searchOpen]);

  useEffect(() => {
    const query = searchQuery.trim();
    setActiveSuggestion(-1);
    if (!searchOpen || query.length < 2) {
      setSuggestions({ products: [], categories: [] });
      setSuggestionsLoading(false);
      setSuggestionsError('');
      return undefined;
    }

    const controller = new AbortController();
    setSuggestionsLoading(true);
    setSuggestionsError('');
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search/suggestions?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        if (!response.ok) throw new Error('Search suggestions are temporarily unavailable.');
        const data = await response.json();
        setSuggestions({
          products: Array.isArray(data.products) ? data.products : [],
          categories: Array.isArray(data.categories) ? data.categories : []
        });
      } catch (error) {
        if (error.name !== 'AbortError') {
          setSuggestions({ products: [], categories: [] });
          setSuggestionsError(error.message || 'Search suggestions are temporarily unavailable.');
        }
      } finally {
        if (!controller.signal.aborted) setSuggestionsLoading(false);
      }
    }, 220);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchOpen, searchQuery]);

  const artworkProducts = useMemo(() => {
    const seen = new Set();
    return [...products, ...newArrivals, ...saleProducts].filter(product => {
      const id = String(product._id || product.sku || product.title || product.name);
      if (seen.has(id) || !getImage(product)) return false;
      seen.add(id);
      return true;
    }).slice(0, 3);
  }, [products, saleProducts, newArrivals]);

  useEffect(() => {
    fetch('/api/admin/home-banner', { credentials: 'include' })
      .then((res) => res.ok ? res.json() : { slides: [] })
      .then((data) => {
        const items = Array.isArray(data?.slides)
          ? data.slides.filter(slide => slide?.imageUrl && !String(slide.imageUrl).includes('/images/sample'))
          : [];
        setSlides(items);
      })
      .catch(() => setSlides([]));
  }, []);

  useEffect(() => {
    if (slides.length < 2) return;
    const timer = setInterval(() => setActiveSlide(index => (index + 1) % slides.length), 5000);
    return () => clearInterval(timer);
  }, [slides]);

  const slide = slides[activeSlide];
  const moveSlide = direction => {
    if (slides.length < 2) return;
    setActiveSlide(index => (index + direction + slides.length) % slides.length);
  };

  return (
    <main className="home-page">
      <section className="home-hero-wrap">
        <div className="home-hero">
          <div className="home-hero-copy">
            <div className="home-eyebrow"><span /> Your everyday stationery store</div>
            <h1>Little things.<br /><span>Big ideas.</span></h1>
            <p className="home-hero-description">Find the tools for learning, creating and getting things done— all in one place.</p>
            <button
              ref={searchTriggerRef}
              type="button"
              onClick={() => setSearchOpen(true)}
              className="home-search home-search-trigger"
              aria-haspopup="dialog"
              aria-expanded={searchOpen}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><circle cx="10.8" cy="10.8" r="6.8" stroke="currentColor" strokeWidth="1.8" /><path d="m16 16 4.2 4.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
              <span className="home-search-placeholder">What are you looking for?</span>
              <span className="home-search-cta">Search</span>
            </button>
            <div className="home-hero-actions">
              <Link href="/shop" className="home-shop-button">Explore the shop <span aria-hidden="true">↗</span></Link>
              <span className="home-hero-hint">Pens, paper, art supplies & more</span>
            </div>
          </div>
          <div className="home-hero-visual">
            {slide ? (
              <div className="home-promo-art">
                <Link href={slide.link || '/shop'} aria-label={slide.altText || slide.caption || 'Shop this collection'}>
                  <img src={slide.imageUrl} alt={slide.altText || ''} />
                </Link>
                {(slide.caption || slides.length > 1) && (
                  <div className="home-promo-caption">
                    <span>{slide.caption || 'Find your next favourite'}</span>
                    {slides.length > 1 && <div className="home-promo-controls">
                      <button type="button" onClick={() => moveSlide(-1)} aria-label="Previous promotion">←</button>
                      <button type="button" onClick={() => moveSlide(1)} aria-label="Next promotion">→</button>
                    </div>}
                  </div>
                )}
                {slides.length > 1 && <div className="home-promo-dots" aria-label={`Promotion ${activeSlide + 1} of ${slides.length}`}>
                  {slides.map((item, index) => <button key={`${item.imageUrl}-${index}`} type="button" aria-label={`Show promotion ${index + 1}`} aria-current={index === activeSlide ? 'true' : undefined} onClick={() => setActiveSlide(index)} />)}
                </div>}
              </div>
            ) : <ProductArtwork products={artworkProducts} />}
          </div>
          <div className="home-hero-bottom" aria-hidden="true">
            <span>THINK</span><i /><span>MAKE</span><i /><span>DO</span>
          </div>
        </div>
      </section>

      <section className="home-categories content-shell" aria-label="Shop by category">
        <div className="home-section-heading">
          <div><span className="home-section-kicker">A good place to start</span><h2>Shop by category</h2></div>
          <Link href="/shop" className="home-text-link">See everything <span aria-hidden="true">↗</span></Link>
        </div>
        <div className="home-category-grid">
          {quickReachItems.map(item => (
            <Link key={item.category} href={{ pathname: '/shop', query: { category: item.category } }} className={`home-category-card ${item.tone}`}>
              <span className="home-category-icon" aria-hidden="true">{item.icon}</span>
              <span className="home-category-copy"><strong>{item.category}</strong><small>{item.note}</small></span>
              <span className="home-category-arrow" aria-hidden="true">↗</span>
            </Link>
          ))}
        </div>
      </section>

      {products.length > 0 && (
        <section className="home-product-section content-shell">
          <div className="home-section-heading">
            <div><span className="home-section-kicker">Picked for you</span><h2>Popular right now</h2></div>
            <Link href="/shop" className="home-text-link">Shop all <span aria-hidden="true">↗</span></Link>
          </div>
          <div className="home-product-row">
            {products.slice(0, 8).map((product, index) => (
              <div key={product._id || product.sku || index} className="home-product-cell"><ProductCard product={product} /></div>
            ))}
          </div>
        </section>
      )}

      {saleProducts.length > 0 && (
        <section className="home-product-section home-sale-section content-shell">
          <div className="home-section-heading">
            <div><span className="home-section-kicker">A little extra value</span><h2>Good finds, better prices</h2></div>
            <Link href="/shop" className="home-text-link">See offers <span aria-hidden="true">↗</span></Link>
          </div>
          <div className="home-product-row">
            {saleProducts.slice(0, 8).map((product, index) => (
              <div key={product._id || product.sku || index} className="home-product-cell"><ProductCard product={product} /></div>
            ))}
          </div>
        </section>
      )}

      {newArrivals.length > 0 && (
        <section className="home-product-section content-shell">
          <div className="home-section-heading">
            <div><span className="home-section-kicker">Just landed</span><h2>Fresh on the shelves</h2></div>
            <Link href="/shop" className="home-text-link">See new arrivals <span aria-hidden="true">↗</span></Link>
          </div>
          <div className="home-product-row">
            {newArrivals.slice(0, 8).map((product, index) => (
              <div key={product._id || product.sku || index} className="home-product-cell"><ProductCard product={product} /></div>
            ))}
          </div>
        </section>
      )}
      {searchOpen && createPortal(
        <div
          className="home-search-overlay"
          onMouseDown={event => {
            if (event.target === event.currentTarget) closeSearch();
          }}
        >
          <img src="/images/logo.jpeg" alt="" className="home-search-watermark" />
          <section
            ref={searchDialogRef}
            className="home-search-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="home-search-title"
          >
            <button
              type="button"
              className="home-search-close"
              onClick={closeSearch}
              aria-label="Close search"
            >
              <span aria-hidden="true">×</span>
            </button>
            <div className="home-search-mark" aria-hidden="true">✦</div>
            <p className="home-search-kicker">A little inspiration goes a long way</p>
            <h2 id="home-search-title">What are you dreaming up today?</h2>
            <p className="home-search-caption">Find the little things that help make big ideas happen.</p>
            <form action="/shop" className="home-search-dialog-form">
              <label className="sr-only" htmlFor="home-product-search">Search products</label>
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><circle cx="10.8" cy="10.8" r="6.8" stroke="currentColor" strokeWidth="1.8" /><path d="m16 16 4.2 4.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
              <input
                ref={searchInputRef}
                id="home-product-search"
                name="q"
                type="search"
                value={searchQuery}
                onChange={event => setSearchQuery(event.target.value)}
                onKeyDown={handleSearchKeyDown}
                aria-autocomplete="list"
                aria-controls="home-search-suggestions"
                aria-expanded={suggestionLinks.length > 0}
                aria-activedescendant={activeSuggestion >= 0 ? `home-search-option-${activeSuggestion}` : undefined}
                placeholder="Try “colour pencils” or “notebook”"
                autoComplete="off"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="home-search-clear"
                  onClick={() => {
                    setSearchQuery('');
                    searchInputRef.current?.focus();
                  }}
                  aria-label="Clear search"
                >
                  ×
                </button>
              )}
              <button type="submit">Search</button>
            </form>
            {searchQuery.trim().length < 2 ? (
              <p className="home-search-footnote">Type at least 2 letters to explore products, categories and pages.</p>
            ) : (
              <div id="home-search-suggestions" className="home-search-suggestions" role="listbox" aria-label="Search suggestions">
                {suggestionsLoading && <p className="home-search-status">Finding good things for you…</p>}
                {suggestionsError && <p className="home-search-status home-search-status-error">{suggestionsError}</p>}
                {!suggestionsLoading && !suggestionsError && suggestionLinks.length === 0 && (
                  <p className="home-search-status">No matches yet. Try another word or search all products.</p>
                )}
                {suggestionLinks.map((item, index) => (
                  <Link
                    key={`${item.kind}-${item.href}`}
                    id={`home-search-option-${index}`}
                    href={item.href}
                    role="option"
                    aria-selected={index === activeSuggestion}
                    className={`home-search-suggestion${index === activeSuggestion ? ' is-active' : ''}`}
                    onMouseEnter={() => setActiveSuggestion(index)}
                    onClick={() => setSearchOpen(false)}
                  >
                    {item.kind === 'product' ? (
                      <>
                        <span className="home-search-suggestion-image">
                          {getSuggestionImage(item.image)
                            ? <img src={getSuggestionImage(item.image)} alt="" />
                            : <span aria-hidden="true">✎</span>}
                        </span>
                        <span className="home-search-suggestion-copy">
                          <strong>{item.title}</strong>
                          <small>{item.fuzzy ? `Closest match · ${item.category || 'Product'}` : (item.category || 'Product')}</small>
                        </span>
                        {item.price != null && (
                          <span className="home-search-suggestion-price">
                            ₹{item.onSale && item.salePrice ? item.salePrice : item.price}
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        <span className={`home-search-suggestion-icon is-${item.kind}`} aria-hidden="true">
                          {item.kind === 'category' ? '▤' : '↗'}
                        </span>
                        <span className="home-search-suggestion-copy">
                          <strong>{item.title}</strong>
                          <small>{item.fuzzy ? `Closest match · ${item.kind === 'category' ? 'Category' : item.subtitle}` : (item.kind === 'category' ? 'Category' : item.subtitle)}</small>
                        </span>
                      </>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>,
        document.body
      )}
    </main>
  );
}

export async function getServerSideProps() {
  try {
    await dbConnect();
    const [products, saleProducts, newArrivals] = await Promise.all([
      Product.find({ featured: true }).limit(8).lean(),
      Product.find({ $or: [{ onSale: true }, { tags: 'SALE!' }] }).limit(8).lean(),
      Product.find({ isNewArrival: true }).sort({ createdAt: -1 }).limit(8).lean()
    ]);
    return { props: {
      products: JSON.parse(JSON.stringify(products || [])),
      saleProducts: JSON.parse(JSON.stringify(saleProducts || [])),
      newArrivals: JSON.parse(JSON.stringify(newArrivals || []))
    } };
  } catch (error) {
    console.warn('Could not load home products', error?.message || error);
    return { props: { products: [], saleProducts: [], newArrivals: [] } };
  }
}
