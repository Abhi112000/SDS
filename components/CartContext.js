import { createContext, useEffect, useState } from 'react';
export const CartContext = createContext();
export function CartProvider({ children }){
  const [cart, setCart] = useState({ items: [], coupon: null });
  useEffect(()=>{ try{ const raw = localStorage.getItem('sd_cart'); if(raw) setCart(JSON.parse(raw)); }catch{} }, []);
  useEffect(()=> localStorage.setItem('sd_cart', JSON.stringify(cart)), [cart]);
  const add = (product, qty=1)=> setCart(prev=>{
    const items = [...prev.items];
    const productId = product._id || product.sku || (product.title || '').replace(/\s+/g,'-').toLowerCase();
    const idx = items.findIndex(i=>i.productId===productId);
    if(idx>-1) items[idx].qty += qty;
    else {
      function pickSize(item){
        if(!item) return null;
        if(typeof item === 'string') return item;
        if(typeof item === 'object') return item.url || item.card || item.large || item.thumb || null;
        return null;
      }
      // ensure price uses numeric value and prefer salePrice when present
      const pPrice = (product.salePrice !== undefined && (product.onSale || (product.tags && product.tags.includes && product.tags.includes('SALE!')))) ? Number(product.salePrice) : Number(product.price || 0);
      items.push({ productId, title: product.title || product.name || 'Product', price: pPrice, qty, image: pickSize(product.image) || pickSize(product.images && product.images[0]) || null });
    }
    return { ...prev, items };
  });
  // emit event for immediate UI updates (header badge)
  useEffect(()=>{
    try{ window.dispatchEvent(new CustomEvent('sd_cart_updated')); }catch(e){}
  },[cart]);
  const updateQty = (productId, qty)=> setCart(prev=>({ ...prev, items: prev.items.map(i=> i.productId===productId?{...i,qty}:i).filter(i=>i.qty>0) }));
  const clear = ()=> setCart({ items: [], coupon: null });
  const remove = (productId)=> setCart(prev=>({ ...prev, items: prev.items.filter(i=>i.productId!==productId) }));
  const setCoupon = (coupon)=> setCart(prev=>({ ...prev, coupon }));
  const subtotal = cart.items.reduce((s,i)=>s + i.qty * i.price, 0);
  return <CartContext.Provider value={{ cart, add, updateQty, remove, clear, setCoupon, subtotal }}>{children}</CartContext.Provider>
}
