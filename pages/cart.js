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
    <div className="max-w-7xl mx-auto px-4 py-10">
      <Breadcrumbs items={[{ label: 'Cart' }]} />
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <div className="page-section-kicker">Basket</div>
          <h1 className="text-3xl md:text-4xl font-bold mb-2 text-slate-900 mt-3">Your Cart</h1>
        </div>
        <button onClick={() => router.back()} className="px-4 py-2 btn-secondary rounded">Back</button>
      </div>
      {cart.items.length === 0 ? (
        <section className="form-panel p-8 text-center">
          <div className="inline-flex items-center justify-center rounded-full bg-slate-100 p-4"><svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-slate-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="20" r="1"/><circle cx="17" cy="20" r="1"/><path d="M3 4h2l2.2 11h12l3-7H7"/></svg></div>
          <h2 className="text-2xl font-bold mt-5 text-slate-900">Your cart is empty</h2>
          <p className="text-slate-600 mt-2">Pick up your study essentials and classroom favourites.</p>
          <Link href="/shop" className="mt-6 inline-flex px-6 py-3 btn-primary rounded-full">Shop stationery</Link>
        </section>
      ) : (
        <div>
          <ul className="space-y-4">
            {cart.items.map((item) => (
              <li key={item.productId} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <img src={item.image||'/images/sample1.svg'} alt={item.title} className="w-20 h-20 object-contain rounded-xl bg-slate-50 p-2" />
                  <div>
                    <div className="font-bold text-slate-900">{item.title}</div>
                    <div className="text-sm text-slate-500 mt-1">₹{item.price}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center border border-slate-200 rounded-full overflow-hidden bg-slate-50">
                    <button className="px-3 py-2 hover:bg-slate-100" onClick={() => updateQty(item.productId, item.qty - 1)} aria-label={`Decrease quantity for ${item.title}`}>-</button>
                    <input aria-label={`Quantity for ${item.title}`} className="w-12 text-center bg-transparent" value={item.qty} onChange={(e)=>{ const v = Math.max(0, Number(e.target.value||0)); updateQty(item.productId, v); }} />
                    <button className="px-3 py-2 hover:bg-slate-100" onClick={() => updateQty(item.productId, item.qty + 1)} aria-label={`Increase quantity for ${item.title}`}>+</button>
                  </div>
                  <div className="flex flex-col items-end">
                    <div className="font-bold text-slate-900">₹{item.price * item.qty}</div>
                    <button onClick={()=>remove(item.productId)} className="text-sm text-red-600 mt-1 hover:underline" aria-label={`Remove ${item.title}`}>Remove</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-6 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
            <div className="grid md:grid-cols-[minmax(0,1fr)_auto] gap-6 items-end">
              <div>
                <div className="font-bold text-lg text-slate-900">Apply a coupon</div>
                <div className="flex gap-2 items-center mt-3">
                  <input value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder="Coupon code" className="form-field max-w-[280px]" />
                  <button onClick={applyCoupon} className="px-4 py-2 btn-primary rounded">Apply</button>
                </div>
                {couponMsg && <div className="mt-3 text-sm text-primary font-semibold">{couponMsg}</div>}
              </div>
              <div className="text-left md:text-right">
                <div className="text-sm text-gray-500">Subtotal</div>
                <div className="font-bold text-slate-900">₹{subtotal}</div>
                {activeCoupon && <div className="text-sm text-gray-500 mt-1">Discount: -₹{activeCoupon.discount}</div>}
                <div className="font-black text-xl mt-2 text-slate-900">Total: ₹{effectiveTotal}</div>
                <button onClick={() => setOpen(true)} className="mt-4 px-6 py-2 btn-primary rounded-full">Place Order</button>
              </div>
            </div>
          </div>
          {publicCoupons.length>0 && (
            <div className="mt-6 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
              <div className="font-bold mb-3 text-slate-900">Offers for you</div>
              <div className="flex gap-2 flex-wrap">
                {publicCoupons.map(c=> (
                  <div key={c._id} className="text-sm bg-green-50 text-green-800 px-3 py-2 rounded-full font-semibold">{c.code} — {c.type==='percent'?`${c.value}%`:`₹${c.value}`}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      <OrderModal open={open} onClose={() => setOpen(false)} coupon={cart.coupon || appliedCoupon} />
    </div>
  );
}
