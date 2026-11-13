import Link from "next/link";
import { useContext, useState } from 'react';
import { useRouter } from 'next/router';
import { CartContext } from './CartContext';

export default function ProductCard({ product }) {
  const rawTitle = product.title || product.name || 'Product';
  const title = String(rawTitle)
    .replace(/\s*[-–]\s*(product|id|product\s*id)\s*[:#]?\s*[A-Za-z0-9]{6,}\s*$/i, '')
    .replace(/\s*[-–]\s*[0-9a-fA-F]{24}\s*$/i, '')
    .replace(/\s*\|\s*(ID|Product ID|product id)\s*[:#]?\s*[A-Za-z0-9]{6,}\s*$/i, '')
    .replace(/\s*\(\s*(ID|Product ID|product id)\s*[:#]?\s*[A-Za-z0-9]{6,}\s*\)\s*$/i, '')
    .replace(/\s*\[[A-Fa-f0-9]{24}\]\s*$/i, '')
    .replace(/\s*\([A-Fa-f0-9]{24}\)\s*$/i, '')
    .trim() || 'Product';
  function pickSize(item, size){
    if(!item) return null;
    const image = typeof item === 'string'
      ? item
      : (typeof item === 'object' ? item.url || item[size] || item.card || item.large || item.thumb || null : null);
    return typeof image === 'string' && /\/images\/sample\d*\.svg(?:$|[?#])/i.test(image) ? null : image;
  }
  const img = pickSize(product.image, 'card') || pickSize(product.images && product.images[0], 'card');
  const category = product.category && !/^[a-f\d]{24}$/i.test(String(product.category))
    ? String(product.category)
    : '';
  const price = typeof product.price === 'number' ? product.price : (product.price || 0);
  const originalPrice = typeof product.originalPrice === 'number' ? product.originalPrice : null;
  const salePrice = typeof product.salePrice === 'number' ? product.salePrice : (product.salePrice ? Number(product.salePrice) : null);
  const isOnSale = !!product.onSale || (!!product.tags && product.tags.includes && product.tags.includes('SALE!'));
  const id = product._id || product.sku || title.replace(/\s+/g, '-').toLowerCase();

  const { add, remove, cart } = useContext(CartContext);
  const router = useRouter();

  async function recordProductVisit() {
    if (typeof window === 'undefined') return;
    const sessionId = window.localStorage.getItem('sd_visitor_session');
    if (!sessionId) return;
    if (router?.pathname?.startsWith('/admin')) return;
    try {
      await fetch('/api/visitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          action: 'product-open',
          page: `/product/${id}`,
          title: title,
          userAgent: navigator.userAgent || '',
          deviceType: window.innerWidth < 768 ? 'phone' : (window.innerWidth < 1024 ? 'tablet' : 'desktop'),
          productId: id,
          productTitle: title
        })
      });
    } catch (e) {
      // ignore tracking errors
    }
  }

  const [justAdded, setJustAdded] = useState(false);
  const inCart = (cart?.items || []).some((item) => item.productId === id);

  const effectivePrice = (isOnSale && salePrice) ? salePrice : price;
  const percentOff = (isOnSale && salePrice && price && price > salePrice) ? Math.round(((price - salePrice) / price) * 100) : null;

  return (
  <article className="product-card">
    {isOnSale ? (
      <div className="product-card-sale-badge"><span aria-hidden="true">✦</span> SALE</div>
    ) : null}
    {percentOff ? (
      <div className="product-card-offer-badge">-{percentOff}%</div>
    ) : null}
      <Link href={`/product/${id}`} onClick={recordProductVisit} className="product-card-image-link">
        <div className="product-card-image-panel">
          {img ? (
            <img src={img} sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw" loading="lazy" alt={title} className="product-card-image" onError={(e)=>{ e.currentTarget.onerror = null; e.currentTarget.remove(); e.currentTarget.parentElement?.classList.add('is-missing'); }} />
          ) : null}
          <div className="product-card-image-placeholder" aria-label={`${title} image unavailable`}>
            <span aria-hidden="true">✎</span>
            <small>Everyday essentials</small>
          </div>
        </div>
      </Link>

      <div className="product-card-body">
        <div className="product-title-stack">
          {category && <span className="product-category-badge">{category}</span>}
          <h3 className="product-title" title={title}>{title}</h3>
        </div>
          <div className="product-price-row">
            {isOnSale && salePrice ? (
              <div>
                <span className="product-original-price">₹{price}</span>
                <span className="product-sale-price">₹{salePrice}</span>
              </div>
            ) : (originalPrice && originalPrice > price ? (
              <div>
                <span className="product-original-price">₹{originalPrice}</span>
                <span className="product-final-price">₹{price}</span>
              </div>
            ) : (
              <span className="product-final-price">₹{price}</span>
            ))}
          </div>
        <div className="product-card-action-row">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              add({ _id: id, title, price: effectivePrice, image: img }, 1);
              setJustAdded(true);
              setTimeout(() => setJustAdded(false), 2500);
            }}
            className="product-add-button"
          >{justAdded ? <><span aria-hidden="true">✓</span> Added</> : <>Add to bag <span aria-hidden="true">+</span></>}</button>

          {(inCart || justAdded) && (
            <div className="mt-2 flex items-center gap-1 cart-remove-row">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                <circle cx="12" cy="12" r="9" fill="#047857" opacity="0.13" />
                <path d="M7.5 12.5l2.5 2.5 6-6" stroke="#047857" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  remove(id);
                }}
                className="cart-remove-button"
              >
                <span className="cart-remove-cross">×</span>
                Remove
              </button>
            </div>
          )}

          {justAdded && !inCart && <div className="product-added-toast" aria-live="polite">Added to cart</div>}
        </div>
      </div>
    </article>
  );
}
