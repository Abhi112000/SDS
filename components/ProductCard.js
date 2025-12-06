import Link from "next/link";
import { useContext, useState } from 'react';
import { useRouter } from 'next/router';
import { CartContext } from './CartContext';

export default function ProductCard({ product }) {
  const title = product.title || product.name || 'Product';
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
  <div className="relative rounded-2xl shadow-2xl hover:shadow-3xl transition-transform transform hover:-translate-y-1 overflow-hidden card flex flex-col h-full shadow-3d glow">
    {isOnSale ? (
      <div className="absolute left-0 top-0 transform -translate-y-2 -translate-x-2 z-20">
        <div className="bg-red-600 text-white text-xs font-semibold px-3 py-1 rounded-tr rounded-br">SALE</div>
      </div>
    ) : null}
    {percentOff ? (
      <div className="absolute right-3 top-3 z-20">
        <div className="bg-red-100 text-red-600 text-xs font-semibold px-2 py-1 rounded">-{percentOff}%</div>
      </div>
    ) : null}
      <Link href={`/product/${id}`} className="block">
        <div className="w-full h-56 product-image-backdrop flex items-center justify-center">
          {/* responsive srcSet: thumb -> card -> large if available */}
          {(() => {
            const pimg = product.image || (product.images && product.images[0]);
            const thumb = pickSize(pimg, 'thumb');
            const card = pickSize(pimg, 'card') || thumb || img;
            const large = pickSize(pimg, 'large') || card;
            const srcSet = `${thumb ? `${thumb} 200w,` : ''} ${card ? `${card} 600w,` : ''} ${large ? `${large} 1200w` : ''}`;
            return <img src={card || img} srcSet={srcSet} sizes="(max-width: 640px) 100vw, 33vw" loading="lazy" alt={title} className="max-h-48 object-contain" onError={(e)=>{ e.currentTarget.onerror = null; e.currentTarget.src = '/images/sample1.svg'; e.currentTarget.srcset = ''; }} />;
          })()}
        </div>
      </Link>

      <div className="p-4 bg-transparent flex-1 flex flex-col">
        <h3 className="text-base md:text-lg font-semibold text-primary truncate" title={title}>{title}</h3>
          <div className="text-muted mt-1" style={{ color: 'rgba(0,0,0,0.62)' }}>
            {isOnSale && salePrice ? (
              <div>
                <span className="text-sm text-gray-500 line-through mr-2">₹{price}</span>
                <span className="font-semibold text-lg text-primary animate-pulse">₹{salePrice}</span>
              </div>
            ) : (originalPrice && originalPrice > price ? (
              <div>
                <span className="text-sm text-gray-500 line-through mr-2">₹{originalPrice}</span>
                <span className="font-semibold text-lg text-primary">₹{price}</span>
              </div>
            ) : (
              <span className="font-semibold text-lg text-primary">₹{price}</span>
            ))}
          </div>
        <div className="mt-auto">
          <button
          onClick={(e) => {
            e.preventDefault();
            // add effective price (sale price if active)
            add({ _id: id, title, price: effectivePrice, image: img }, 1);
            setJustAdded(true);
            setTimeout(()=>setJustAdded(false), 2500);
          }}
          className="mt-4 w-full py-2 rounded-full btn-primary"
        >Add to Cart</button>
        {justAdded && <div className="mt-2 text-sm text-primary">Added to cart</div>}
        </div>
      </div>
    </div>
  );
}
