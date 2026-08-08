// components/OrderModal.js
import { useState, useContext, useEffect } from "react";
import { CartContext } from "./CartContext";
import { useSession } from "next-auth/react";
import { useToast } from '@/components/Toast';

export default function OrderModal({ open, onClose, coupon = null }) {
  const { cart, subtotal, clear } = useContext(CartContext);
  const { data: session } = useSession();
  const toast = useToast();
  // mode: choice | summary | guest
  const [mode, setMode] = useState("choice");
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "", locationUrl: "", whatsapp: "" });
  const [loading, setLoading] = useState(false);

  // If a user is logged in, show the summary view and prefill form with profile info
  useEffect(() => {
    if (!open) return;
    if (session) {
      setMode('summary');
      setForm(prev => ({
        ...prev,
        name: session.user?.name || prev.name || '',
        email: session.user?.email || prev.email || '',
        phone: session.user?.phone || prev.phone || '',
        whatsapp: session.user?.whatsapp || prev.whatsapp || '',
        address: session.user?.address || prev.address || '',
        locationUrl: session.user?.locationUrl || prev.locationUrl || ''
      }));
    } else {
      setMode('choice');
    }
  }, [session, open]);

  const sendWhatsAppOrder = (header, orderId, orderKind) => {
    const ownerWhatsapp = process.env.NEXT_PUBLIC_OWNER_WHATSAPP_NUMBER || process.env.OWNER_WHATSAPP_NUMBER || '919818630972';
    const whatsappPhone = String(ownerWhatsapp).replace(/\D/g, '');

    const cartLines = (cart.items || []).map((it) => `${it.title} x ${it.qty} - ₹${it.price}`).join('\n');
    const discount = Number(coupon?.discount || 0);
    const total = Math.max(subtotal - discount, 0);
    const message = [
      `${header}`,
      orderId ? `Order ID: ${orderId}` : '',
      `Customer Type: ${orderKind}`,
      '',
      'Hello Shree Durga Stationary, I want to place an order.',
      '',
      `Name: ${form.name || ''}`,
      `Phone: ${form.phone || ''}`,
      `Email: ${form.email || ''}`,
      `Address: ${form.address || ''}`,
      `Location URL: ${form.locationUrl || ''}`,
      `WhatsApp: ${String(form.whatsapp || '').trim()}`,
      '',
      'Order Items:',
      cartLines || 'No items selected',
      '',
      `Subtotal: ₹${subtotal}`,
      `Discount: -₹${discount}`,
      `Total: ₹${total}`
    ].filter(Boolean).join('\n');

    if (!whatsappPhone) {
      toast?.push?.({ message: 'WhatsApp number is not configured yet.', type: 'error' });
      return;
    }

    const url = `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    onClose();
  };

  const placeGuest = async () => {
    setLoading(true);
    const payload = {
      items: cart.items,
      subtotal,
      couponCode: coupon?.code || null,
      ...form
    };
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then((r) => r.json());
      setLoading(false);
      if (res.ok) {
        const orderRef = `GUEST-${res.orderId}`;
        clear();
        sendWhatsAppOrder('GUEST ORDER', orderRef, 'Guest');
        toast?.push?.({ message: 'Guest order prepared. Order ID: ' + orderRef, type: 'success' });
      } else {
        toast?.push?.({ message: 'Error placing order: ' + (res.error || 'unknown'), type: 'error' });
      }
    } catch (e) {
      setLoading(false);
      toast?.push?.({ message: 'Network error: ' + (e.message || String(e)), type: 'error' });
    }
  };

  const placeUserOrder = async () => {
    setLoading(true);
    const payload = {
      items: cart.items,
      subtotal,
      couponCode: coupon?.code || null,
      // include profile details so admin sees the info
      name: form.name || session?.user?.name || '',
      phone: form.phone || session?.user?.phone || '',
      email: form.email || session?.user?.email || '',
      whatsapp: form.whatsapp || session?.user?.whatsapp || session?.user?.phone || '' ,
      address: form.address || session?.user?.address || '',
      locationUrl: form.locationUrl || session?.user?.locationUrl || ''
    };
    try{
      const res = await fetch('/api/orders', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then(r=>r.json());
      setLoading(false);
      if(res.ok){
        const orderRef = `ACCOUNT-${res.orderId}`;
        clear();
        sendWhatsAppOrder('ACCOUNT HOLDER ORDER', orderRef, 'Account Holder');
        toast?.push?.({ message: 'Order placed. Order ID: ' + orderRef, type: 'success' });
      }
      else toast?.push?.({ message: 'Error: ' + (res.error||'unknown'), type: 'error' });
  }catch(e){ setLoading(false); toast?.push?.({ message: 'Network error: ' + (e.message||String(e)), type: 'error' }); }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white p-6 rounded max-w-xl w-full relative">
        <button aria-label="close" onClick={onClose} className="absolute right-3 top-3 text-gray-500 hover:text-gray-800">✕</button>
        {mode === "choice" ? (
          <div>
            <h3 className="text-lg font-semibold">Place Order</h3>
            <p className="mt-2">Choose how you want to place the order</p>
            <div className="mt-4 flex gap-3">
              <button onClick={() => { onClose(); window.location.href = "/login"; }} className="px-4 py-2 btn-primary rounded">Login / Register</button>
              {session ? (
                <button onClick={()=> setMode('summary')} className="px-4 py-2 btn-primary rounded">Review & Confirm</button>
              ) : (
                <button onClick={() => setMode("guest")} className="px-4 py-2 btn-primary rounded">Place without account</button>
              )}
            </div>
          </div>
        ) : mode === 'summary' ? (
          <div>
            <h3 className="text-lg font-semibold">Confirm your order</h3>
            <div className="mt-3">
              <div className="mb-3">
                <strong>Items:</strong>
                <ul className="list-disc pl-6 mt-2">
                  {cart.items.map((it) => (
                    <li key={it.productId}>{it.title} — {it.qty} × ₹{it.price}</li>
                  ))}
                </ul>
              </div>
              <div className="space-y-2">
                <input placeholder="Name" className="w-full p-2 border" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                <input placeholder="Phone" className="w-full p-2 border" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                <input placeholder="WhatsApp" className="w-full p-2 border" value={form.whatsapp} onChange={e => setForm({ ...form, whatsapp: e.target.value })} />
                <input placeholder="Email" className="w-full p-2 border" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                <textarea placeholder="Address" className="w-full p-2 border" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
                <input placeholder="Location URL (optional)" className="w-full p-2 border" value={form.locationUrl} onChange={e => setForm({ ...form, locationUrl: e.target.value })} />

                <div className="mt-3 flex justify-between items-center">
                  <div>
                    <div className="text-sm text-gray-500">Subtotal</div>
                    <div className="font-semibold">₹{subtotal}</div>
                    {coupon && <div className="text-sm text-gray-500">Coupon: {coupon.code}</div>}
                    <div className="font-bold text-lg mt-2">Total: ₹{subtotal - (coupon?.discount || 0)}</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setMode('choice')} className="px-3 py-1">Back</button>
                    <button onClick={placeUserOrder} disabled={loading} className="px-4 py-2 btn-primary rounded">{loading ? 'Placing...' : 'Confirm & Submit'}</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <h3 className="text-lg font-semibold">Guest Order</h3>
            <div className="mt-3">
              <div className="mb-3">
                <strong>Items:</strong>
                <ul className="list-disc pl-6 mt-2">
                  {cart.items.map((it) => (
                    <li key={it.productId}>{it.title} — {it.qty} × ₹{it.price}</li>
                  ))}
                </ul>
              </div>
              <div className="space-y-2">
                <input required placeholder="Name*" className="w-full p-2 border" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                <input required placeholder="Phone*" className="w-full p-2 border" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                <input required placeholder="WhatsApp*" className="w-full p-2 border" value={form.whatsapp} onChange={e => setForm({ ...form, whatsapp: e.target.value })} />
                <input required placeholder="Email*" className="w-full p-2 border" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                <textarea required placeholder="Address*" className="w-full p-2 border" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
                <input required placeholder="Location URL (Google Maps) *" className="w-full p-2 border" value={form.locationUrl} onChange={e => setForm({ ...form, locationUrl: e.target.value })} />

                <div className="mt-3 flex justify-end gap-2">
                  <button onClick={() => setMode("choice")} className="px-3 py-1">Back</button>
                  <button onClick={placeGuest} disabled={loading} className="px-4 py-2 btn-primary rounded">{loading ? "Placing..." : "Order on WhatsApp"}</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
