// pages/cart.js
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
    // persist coupon into cart context so it survives navigation
    setCoupon(res.coupon);
    setAppliedCoupon(res.coupon);
    setCouponMsg(`Applied ${res.coupon.code} — saved ₹${res.coupon.discount}`);
  };

  // prefer coupon from cart (persisted) else local appliedCoupon
  const activeCoupon = cart.coupon || appliedCoupon;
  const effectiveTotal = subtotal - (activeCoupon?.discount || 0);

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Cart' }]} />
      <button onClick={() => router.back()} className="mb-4 px-4 py-2 btn-secondary rounded">Back</button>
      <h1 className="text-2xl font-bold mb-4">Cart</h1>
      {cart.items.length === 0 ? (
        <p>Your cart is empty.</p>
      ) : (
        <div>
          <ul className="space-y-3">
            {cart.items.map((item) => (
              <li key={item.productId} className="bg-white p-3 rounded shadow flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img src={item.image||'/images/sample1.svg'} alt={item.title} className="w-16 h-16 object-contain rounded" />
                  <div>
                    <div className="font-semibold">{item.title}</div>
                    <div className="text-sm text-gray-500">₹{item.price}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center border rounded overflow-hidden">
                    <button className="px-3" onClick={() => updateQty(item.productId, item.qty - 1)} aria-label={`Decrease quantity for ${item.title}`}>-</button>
                    <input aria-label={`Quantity for ${item.title}`} className="w-12 text-center" value={item.qty} onChange={(e)=>{ const v = Math.max(0, Number(e.target.value||0)); updateQty(item.productId, v); }} />
                    <button className="px-3" onClick={() => updateQty(item.productId, item.qty + 1)} aria-label={`Increase quantity for ${item.title}`}>+</button>
                  </div>
                  <div className="flex flex-col items-end">
                    <div className="font-semibold">₹{item.price * item.qty}</div>
                    <button onClick={()=>remove(item.productId)} className="text-sm text-red-600 mt-1" aria-label={`Remove ${item.title}`}>Remove</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-4 bg-white p-4 rounded shadow">
            <div className="flex gap-2 items-center">
              <input value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder="Coupon code" className="p-2 border rounded" />
              <button onClick={applyCoupon} className="px-4 py-2 btn-primary rounded">Apply</button>
            </div>
            {couponMsg && <div className="mt-2 text-sm text-primary">{couponMsg}</div>}
            <div className="mt-3 flex justify-between items-center">
              <div>
                <div className="text-sm text-gray-500">Subtotal</div>
                <div className="font-semibold">₹{subtotal}</div>
                {activeCoupon && <div className="text-sm text-gray-500">Discount: -₹{activeCoupon.discount}</div>}
                <div className="font-bold text-lg mt-2">Total: ₹{effectiveTotal}</div>
              </div>
              <button onClick={() => setOpen(true)} className="px-4 py-2 btn-primary rounded">Place Order</button>
            </div>
          </div>
          {publicCoupons.length>0 && (
            <div className="mt-4 bg-white p-3 rounded shadow">
              <div className="font-semibold mb-2">Offers for you</div>
              <div className="flex gap-2 flex-wrap">
                {publicCoupons.map(c=> (
                  <div key={c._id} className="text-sm bg-green-50 text-green-800 px-2 py-1 rounded">{c.code} — {c.type==='percent'?`${c.value}%`:`₹${c.value}`}</div>
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
