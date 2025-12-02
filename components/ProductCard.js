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
  const id = product._id || product.sku || title.replace(/\s+/g, '-').toLowerCase();

  const { add } = useContext(CartContext);
  const router = useRouter();

  const [justAdded, setJustAdded] = useState(false);

  return (
  <div className="rounded-2xl shadow-2xl hover:shadow-3xl transition-transform transform hover:-translate-y-1 overflow-hidden card flex flex-col h-full shadow-3d glow">
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
            {originalPrice && originalPrice > price ? (
              <div>
                <span className="text-sm text-gray-500 line-through mr-2">₹{originalPrice}</span>
                <span className="font-semibold text-lg text-primary">₹{price}</span>
              </div>
            ) : (
              <span className="font-semibold text-lg text-primary">₹{price}</span>
            )}
          </div>
        <div className="mt-auto">
        <button
          onClick={(e) => {
            e.preventDefault();
            add({ _id: id, title, price, image: img });
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
