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
    if(typeof item === 'string') return item;
    if(typeof item === 'object') return item.url || item[size] || item.card || item.large || item.thumb || null;
    return null;
  }
  const img = pickSize(product.image, 'card') || pickSize(product.images && product.images[0], 'card') || '/images/sample1.svg';
  const price = typeof product.price === 'number' ? product.price : (product.price || 0);
  const originalPrice = typeof product.originalPrice === 'number' ? product.originalPrice : null;
  const salePrice = typeof product.salePrice === 'number' ? product.salePrice : (product.salePrice ? Number(product.salePrice) : null);
  const isOnSale = !!product.onSale || (!!product.tags && product.tags.includes && product.tags.includes('SALE!'));
  const id = product._id || product.sku || title.replace(/\s+/g, '-').toLowerCase();

  const { add } = useContext(CartContext);
  const router = useRouter();

  const [justAdded, setJustAdded] = useState(false);

  const effectivePrice = (isOnSale && salePrice) ? salePrice : price;
  const percentOff = (isOnSale && salePrice && price && price > salePrice) ? Math.round(((price - salePrice) / price) * 100) : null;

  return (
  <article className="product-card">
    {isOnSale ? (
      <div className="product-card-sale-badge">SALE</div>
    ) : null}
    {percentOff ? (
      <div className="product-card-offer-badge">-{percentOff}%</div>
    ) : null}
      <Link href={`/product/${id}`} className="product-card-image-link">
        <div className="product-card-image-panel">
          {/* responsive srcSet: thumb -> card -> large if available */}
          {(() => {
            const pimg = product.image || (product.images && product.images[0]);
            const thumb = pickSize(pimg, 'thumb');
            const card = pickSize(pimg, 'card') || thumb || img;
            const large = pickSize(pimg, 'large') || card;
            const srcSet = `${thumb ? `${thumb} 200w,` : ''} ${card ? `${card} 600w,` : ''} ${large ? `${large} 1200w` : ''}`;
            return <img src={card || img} srcSet={srcSet} sizes="(max-width: 640px) 100vw, 33vw" loading="lazy" alt={title} className="product-card-image" onError={(e)=>{ e.currentTarget.onerror = null; e.currentTarget.src = '/images/sample1.svg'; e.currentTarget.srcset = ''; }} />;
          })()}
        </div>
      </Link>

      <div className="product-card-body">
        <div className="product-title-stack">
          <h3 className="product-title" title={title}>{title}</h3>
          {product.category && <span className="product-category-badge">{product.category}</span>}
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
          onClick={(e) => {
            e.preventDefault();
            add({ _id: id, title, price: effectivePrice, image: img }, 1);
            setJustAdded(true);
            setTimeout(()=>setJustAdded(false), 2500);
          }}
          className="product-add-button"
        >Add to Cart</button>
        {justAdded && <div className="product-added-toast" aria-live="polite">Added to cart</div>}
        </div>
      </div>
    </article>
  );
}
