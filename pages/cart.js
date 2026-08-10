// pages/cart.js
import Link from 'next/link';
import { useContext, useEffect, useState } from "react";
import { CartContext } from "../components/CartContext";
import OrderModal from "../components/OrderModal";
import Breadcrumbs from '../components/Breadcrumbs';
import { useRouter } from 'next/router';

export default function Cart() {
  const router = useRouter();
  const { cart, updateQty, remove, setCoupon, subtotal } = useContext(CartContext);
  const [open, setOpen] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponCode, setCouponCode] = useState("");
  const [couponMsg, setCouponMsg] = useState("");
  const [publicCoupons, setPublicCoupons] = useState([]);

  useEffect(()=>{
    let mounted = true;
    fetch('/api/coupons').then(r=>r.json()).then(j=>{ if(mounted && j?.coupons) setPublicCoupons(j.coupons); }).catch(()=>{});
    return ()=>{ mounted = false };
  },[]);

  const applyCoupon = async () => {
    if (!couponCode) return setCouponMsg("Enter coupon code");
    const res = await fetch("/api/coupons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: couponCode, subtotal })
    }).then((r) => r.json());
    if (!res.ok) {
      setCouponMsg(res.error || "Invalid coupon");
      return;
    }
    setCoupon(res.coupon);
    setAppliedCoupon(res.coupon);
    setCouponMsg(`Applied ${res.coupon.code} — saved ₹${res.coupon.discount}`);
  };

  const activeCoupon = cart.coupon || appliedCoupon;
  const effectiveTotal = subtotal - (activeCoupon?.discount || 0);

  return (
    <div className="max-w-7xl mx-auto px-3 py-4 sm:px-4">
      <Breadcrumbs items={[{ label: 'Cart' }]} />
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div>
          <div className="page-section-kicker">Basket</div>
          <h1 className="text-xl md:text-2xl font-bold mb-0.5 text-slate-900">Your Cart</h1>
        </div>
        <button onClick={() => router.back()} className="px-2.5 py-1 btn-secondary rounded text-sm">Back</button>
      </div>
      {cart.items.length === 0 ? (
        <section className="form-panel p-4 text-center cart-empty-panel">
          <div className="inline-flex items-center justify-center rounded-full bg-slate-100 p-2"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="20" r="1"/><circle cx="17" cy="20" r="1"/><path d="M3 4h2l2.2 11h12l3-7H7"/></svg></div>
          <h2 className="text-lg md:text-xl font-bold mt-3 text-slate-900">Your cart is empty</h2>
          <p className="text-slate-600 mt-1 text-sm">Pick up your study essentials and classroom favourites.</p>
          <Link href="/shop" className="mt-4 inline-flex px-4 py-2 btn-primary rounded-full text-sm">Shop stationery</Link>
        </section>
      ) : (
        <div>
          <ul className="space-y-2">
            {cart.items.map((item) => (
              <li key={item.productId} className="cart-item-card py-3 px-3 sm:px-4">
                <div className="flex gap-3 items-start">
                  <img src={item.image||'/images/sample1.svg'} alt={item.title} className="w-14 h-14 rounded-2xl bg-slate-50 p-1.5 object-contain" />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-slate-900 text-sm truncate">{item.title}</div>
                    <div className="text-[11px] text-slate-500 mt-1">Unit price ₹{item.price}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <div className="cart-qty-control">
                        <button className="qty-button" onClick={() => updateQty(item.productId, item.qty - 1)} aria-label={`Decrease quantity for ${item.title}`}>-</button>
                        <input aria-label={`Quantity for ${item.title}`} className="qty-input" value={item.qty} onChange={(e)=>{ const v = Math.max(0, Number(e.target.value||0)); updateQty(item.productId, v); }} />
                        <button className="qty-button" onClick={() => updateQty(item.productId, item.qty + 1)} aria-label={`Increase quantity for ${item.title}`}>+</button>
                      </div>
                      <button onClick={()=>remove(item.productId)} className="text-[11px] text-slate-600 hover:text-red-700 font-semibold" aria-label={`Remove ${item.title}`}>Remove</button>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 text-right">
                    <div className="font-semibold text-slate-900 text-sm">₹{item.price * item.qty}</div>
                    <div className="text-[11px] text-slate-500">{item.qty} item{item.qty===1?'':'s'}</div>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-4 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm cart-summary-panel">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
              <div>
                <div className="font-semibold text-sm text-slate-900">Apply coupon</div>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
                  <input value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder="Coupon code" className="form-field max-w-[200px] text-sm" />
                  <button onClick={applyCoupon} className="px-3 py-2 btn-primary rounded text-sm">Apply</button>
                </div>
                {couponMsg && <div className="mt-1 text-sm text-primary font-semibold">{couponMsg}</div>}
              </div>
              <div className="text-left md:text-right">
                <div className="text-[11px] text-gray-500">Subtotal</div>
                <div className="font-semibold text-slate-900">₹{subtotal}</div>
                {activeCoupon && <div className="text-[11px] text-gray-500 mt-1">Discount -₹{activeCoupon.discount}</div>}
                <div className="font-black text-lg mt-1 text-slate-900">₹{effectiveTotal}</div>
                <button onClick={() => setOpen(true)} className="mt-2 px-4 py-2 btn-primary rounded-full text-sm">Place Order</button>
              </div>
            </div>
          </div>
          <div className="mt-5 bg-white p-3 rounded-2xl border border-slate-100 shadow-sm offers-panel">
            <div className="font-semibold mb-3 text-slate-900 text-sm">Offers for you</div>
            {publicCoupons.length > 0 ? (
              <div className="flex gap-2 flex-wrap">
                {publicCoupons.map(c => (
                  <div key={c._id} className="text-xs bg-green-50 text-green-800 px-2.5 py-1.5 rounded-full font-semibold">{c.code} — {c.type === 'percent' ? `${c.value}%` : `₹${c.value}`}</div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-slate-500">No coupons available right now.</div>
            )}
          </div>
        </div>
      )}
      <OrderModal open={open} onClose={() => setOpen(false)} coupon={cart.coupon || appliedCoupon} />
    </div>
  );
}
