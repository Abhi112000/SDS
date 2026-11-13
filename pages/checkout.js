import { useContext, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { CartContext } from '../components/CartContext';
import Breadcrumbs from '../components/Breadcrumbs';
import { useToast } from '@/components/Toast';

export default function Checkout(){
  const { cart, subtotal, clear } = useContext(CartContext);
  const [processing, setProcessing] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [confirmedTotal, setConfirmedTotal] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '' });
  const toast = useToast();

  const placeOrder = async event => {
    event.preventDefault();
    if(cart.items.length === 0) return toast?.push?.({ message: 'Cart is empty', type: 'error' });
    setProcessing(true);
    try{
      const response = await fetch('/api/orders', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.items,
          couponCode: cart.coupon?.code || undefined,
          ...form
        })
      });
      const result = await response.json();
      if(!response.ok) throw new Error(result.error || 'Order could not be placed');
      setOrderId(result.orderId);
      setConfirmedTotal(result.total);
      clear();
      toast?.push?.({ message: 'Order placed. Online payment has not been processed.', type: 'success' });
    }catch(error){
      toast?.push?.({ message: error.message || 'Order could not be placed', type: 'error' });
    }finally{
      setProcessing(false);
    }
  };

  return (
    <main className="max-w-4xl mx-auto py-12 px-4">
      <Head><title>Checkout — Shree Durga Stationery</title></Head>
      <Breadcrumbs items={[{ label: 'Cart', href: '/cart' }, { label: 'Checkout' }]} />
      <h1 className="text-2xl font-bold mb-4">Checkout</h1>
      {orderId ? (
        <section className="card">
          <h2 className="font-semibold text-lg">Order placed</h2>
          <p className="mt-2">Order reference: {orderId}</p>
          <p className="mt-1">Confirmed total: ₹{Number(confirmedTotal || 0).toFixed(2)}</p>
          <p className="mt-2 text-sm text-slate-600">No online payment was taken. The shop will contact you to confirm payment and delivery.</p>
          <Link href="/shop" className="inline-block mt-4 px-4 py-2 btn-primary rounded">Continue shopping</Link>
        </section>
      ) : (
        <form onSubmit={placeOrder} className="grid md:grid-cols-2 gap-6">
          <section className="card">
            <h2 className="font-semibold mb-3">Order Summary</h2>
            {cart.items.length === 0 ? <p>Your cart is empty. <Link href="/cart" className="underline">Return to cart</Link>.</p> : (
              <ul className="space-y-2">
                {cart.items.map(item => <li key={item.productId} className="flex justify-between"><span>{item.title} × {item.qty}</span><span>₹{Number(item.price) * Number(item.qty)}</span></li>)}
              </ul>
            )}
            <div className="mt-4 flex justify-between"><span>Subtotal</span><strong>₹{subtotal}</strong></div>
            {cart.coupon && <div className="flex justify-between text-sm"><span>Coupon {cart.coupon.code}</span><span>-₹{cart.coupon.discount || 0}</span></div>}
            <div className="mt-1 flex justify-between font-semibold"><span>Total</span><span>₹{Math.max(0, subtotal - Number(cart.coupon?.discount || 0))}</span></div>
          </section>
          <section className="card">
            <h2 className="font-semibold mb-2">Contact and delivery details</h2>
            <p className="text-sm text-slate-600 mb-3">This places an order request; it does not charge a payment method.</p>
            <div className="space-y-3">
              <input required value={form.name} onChange={event=>setForm({ ...form, name: event.target.value })} placeholder="Name*" className="w-full p-2 border rounded" />
              <input required value={form.phone} onChange={event=>setForm({ ...form, phone: event.target.value })} placeholder="Phone*" className="w-full p-2 border rounded" />
              <input type="email" value={form.email} onChange={event=>setForm({ ...form, email: event.target.value })} placeholder="Email (optional)" className="w-full p-2 border rounded" />
              <textarea required value={form.address} onChange={event=>setForm({ ...form, address: event.target.value })} placeholder="Address*" rows={3} className="w-full p-2 border rounded" />
              <button type="submit" disabled={processing || cart.items.length === 0} className="px-4 py-2 btn-primary rounded">{processing ? 'Placing order…' : 'Place order'}</button>
            </div>
          </section>
        </form>
      )}
    </main>
  );
}
