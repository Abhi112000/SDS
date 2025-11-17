import { useContext, useState } from 'react';
import { useToast } from '@/components/Toast';
import Head from 'next/head';
import { CartContext } from '../components/CartContext';
import Breadcrumbs from '../components/Breadcrumbs';

export default function Checkout(){
  const { cart, subtotal, clear } = useContext(CartContext);
  const [processing, setProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('card');
  const toast = useToast();

  const placeOrder = async ()=>{
  if(cart.items.length===0) return toast?.push?.({ message: 'Cart is empty', type: 'error' });
    setProcessing(true);
    const payload = { items: cart.items, subtotal, paymentMethod, guest: true, coupon: cart.coupon || null };
    try{
      const res = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then(r=>r.json());
  setProcessing(false);
  if(!res.ok) return toast?.push?.({ message: 'Order failed: ' + (res.error||'unknown'), type: 'error' });
  // simple payment placeholder: in production you'd integrate gateway here
  toast?.push?.({ message: 'Payment successful (demo). Order: ' + res.orderId, type: 'success' });

      // open a printable invoice window
  const totalAfterDiscount = subtotal - (cart.coupon?.discount || 0);
  const invHtml = `<!doctype html><html><head><meta charset="utf-8"><title>Invoice - ${res.orderId}</title><style>body{font-family:Arial,Helvetica,sans-serif;padding:24px} .logo{max-height:80px;object-fit:contain} .items td{padding:6px 8px;border-bottom:1px solid #eee}</style></head><body><img class="logo" src="/images/logo.jpeg" alt="logo"/><h2>Invoice</h2><div>Order ID: ${res.orderId}</div><table class="items" style="width:100%;border-collapse:collapse;margin-top:12px"><thead><tr><th align="left">Item</th><th>Qty</th><th align="right">Price</th></tr></thead><tbody>${cart.items.map(it=>`<tr><td>${it.title}</td><td align="center">${it.qty}</td><td align="right">₹${it.price*it.qty}</td></tr>`).join('')}</tbody></table><div style="margin-top:12px"><strong>Subtotal:</strong> ₹${subtotal}</div>${cart.coupon?`<div><strong>Coupon ${cart.coupon.code}:</strong> -₹${cart.coupon.discount}</div>`:''}<div style="margin-top:6px"><strong>Total:</strong> ₹${totalAfterDiscount}</div></body></html>`;
      const w = window.open('about:blank','invoice'); if(w){ w.document.write(invHtml); w.document.close(); setTimeout(()=>{ try{ w.focus(); w.print(); }catch(e){} },400); }

      // try to persist invoice to admin invoices for history (best-effort; will fail silently if not admin)
  try{ fetch('/api/admin/invoices',{ method:'POST', credentials:'include', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ invoiceId: res.orderId, type:'order', orderId: res.orderId, payload: { items: cart.items, subtotal, paymentMethod, coupon: cart.coupon || null }, subtotal, discount: cart.coupon?.discount || 0, shipping: 0, tax: 0, total: totalAfterDiscount }) }).catch(()=>{}); }catch(e){}

      clear();
      window.location.href = '/';
  }catch(e){ setProcessing(false); toast?.push?.({ message: 'Network error: ' + (e.message||e), type: 'error' }); }
  };

  return (
    <main className="max-w-4xl mx-auto py-12 px-4">
      <Head><title>Checkout — Shree Durga Stationary</title></Head>
      <Breadcrumbs items={[{ label: 'Cart', href: '/cart' }, { label: 'Checkout' }]} />
      <h1 className="text-2xl font-bold mb-4">Checkout</h1>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="font-semibold mb-3">Order Summary</h2>
          {cart.items.length===0 ? <div>Your cart is empty.</div> : (
            <ul className="space-y-2">
              {cart.items.map(it=> (
                <li key={it.productId} className="flex justify-between"><div>{it.title} × {it.qty}</div><div>₹{it.price * it.qty}</div></li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex justify-between"><div className="text-muted">Subtotal</div><div className="font-semibold">₹{subtotal}</div></div>
        </div>

        <div className="card">
          <h2 className="font-semibold mb-3">Payment</h2>
          <p className="text-sm text-muted">This is a demo payment placeholder. Integrate a payment gateway in production.</p>
          <div className="mt-3">
            <label className="block"><input type="radio" name="pm" checked={paymentMethod==='card'} onChange={()=>setPaymentMethod('card')} /> Card</label>
            <label className="block mt-2"><input type="radio" name="pm" checked={paymentMethod==='upi'} onChange={()=>setPaymentMethod('upi')} /> UPI / Wallet</label>
          </div>

          <div className="mt-6 flex justify-end">
            <button onClick={placeOrder} disabled={processing} className="px-4 py-2 btn-primary rounded">{processing ? 'Processing...' : 'Pay & Place Order'}</button>
          </div>
        </div>
      </div>
    </main>
  );
}
