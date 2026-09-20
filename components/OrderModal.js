// components/OrderModal.js
import { useState, useContext, useEffect } from "react";
import { CartContext } from "./CartContext";
import { useSession } from "next-auth/react";
import { useToast } from '@/components/Toast';

export default function OrderModal({ open, onClose, coupon = null }) {
  const { cart, subtotal, clear } = useContext(CartContext);
  const { data: session, status: sessionStatus } = useSession();
  const toast = useToast();
  // mode: choice | summary | guest
  const [mode, setMode] = useState("choice");
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "", deliveryPincode: "", locationUrl: "", whatsapp: "" });
  const [loading, setLoading] = useState(false);
  // Removed delivery/location states for simplified ordering flow
  const shopPincode = '201002';

  const shopLatitude = Number(process.env.NEXT_PUBLIC_SHOP_LATITUDE);
  const shopLongitude = Number(process.env.NEXT_PUBLIC_SHOP_LONGITUDE);

  // delivery/location functions removed — simplified order flow: no delivery calculation

  const deliveryCharge = 0;
  const deliveryRoughDistanceKm = null;

  function ensureDeliveryReady(){ return true; }

  // If a user is logged in, show the summary view and prefill form with profile info
  useEffect(() => {
    if (!open) return;
    if (sessionStatus === 'loading') return;
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
  }, [session, sessionStatus, open]);

  const sendWhatsAppOrder = (header, orderId, orderKind) => {
    const ownerWhatsapp = process.env.NEXT_PUBLIC_OWNER_WHATSAPP_NUMBER || process.env.OWNER_WHATSAPP_NUMBER || '919818630972';
    const whatsappPhone = String(ownerWhatsapp).replace(/\D/g, '');

    const cartLines = (cart.items || []).map((it) => `${it.title} x ${it.qty} - ₹${it.price}`).join('\n');
    const discount = Number(coupon?.discountAmount ?? coupon?.discount ?? 0);
    const total = Math.max(subtotal - discount + deliveryCharge, 0);
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
      `WhatsApp: ${String(form.whatsapp || '').trim()}`,
      '',
      'Order Items:',
      cartLines || 'No items selected',
      '',
      `Subtotal: ₹${subtotal}`,
      `Discount: -₹${discount}`,
      `Total: ₹${total}`
    ].filter(Boolean).join('\n');
    const finalMessage = message;

    if (!whatsappPhone) {
      toast?.push?.({ message: 'WhatsApp number is not configured yet.', type: 'error' });
      return;
    }

    const url = `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(finalMessage)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    onClose();
  };

  const placeGuest = async () => {
    if (!ensureDeliveryReady()) return;
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
    if (!ensureDeliveryReady()) return;
    setLoading(true);
    const payload = {
      items: cart.items,
      subtotal,
      couponCode: coupon?.code || null,
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
    <div className="modal-overlay">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="modal-panel smaller relative shadow-xl compact-gap" onClick={(e)=>e.stopPropagation()}>
        <button aria-label="close" onClick={onClose} className="absolute right-3 top-3 text-gray-500 hover:text-gray-800">✕</button>
        {sessionStatus === 'loading' ? (
          <div className="py-8 text-center text-sm text-slate-600">Checking your account...</div>
        ) : mode === "choice" ? (
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
            <div className="mt-2">
              <div className="mb-2">
                <strong className="text-sm">Items:</strong>
                <ul className="list-disc pl-5 mt-1 max-h-24 overflow-y-auto text-sm">
                  {cart.items.map((it) => (
                    <li key={it.productId}>{it.title} — {it.qty} × ₹{it.price}</li>
                  ))}
                </ul>
              </div>
              <div className="space-y-1.5 text-sm">
                <div className="rounded border border-slate-200 bg-slate-50 p-2 text-xs">
                  <strong className="block text-sm">Customer</strong>
                  <div>{session?.user?.name || form.name || 'Not provided'}</div>
                  <div>{session?.user?.phone || form.phone || 'Not provided'} • {session?.user?.email || form.email || 'Not provided'}</div>
                  <div>{session?.user?.address || form.address || 'No saved address'}</div>
                  {(session?.user?.locationUrl || form.locationUrl) && <a href={session?.user?.locationUrl || form.locationUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline">Open saved location</a>}
                </div>

                <div className="space-y-2">
                  <input placeholder="Name" className="w-full p-2 border rounded" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5"><input placeholder="Phone" className="w-full p-2 border rounded" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /><input placeholder="WhatsApp" className="w-full p-2 border rounded" value={form.whatsapp} onChange={e => setForm({ ...form, whatsapp: e.target.value })} /></div>
                  <input placeholder="Email" className="w-full p-2 border rounded" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                  <textarea placeholder="Address" className="w-full p-2 border rounded" rows={2} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
                  <input placeholder="Location URL (optional)" className="w-full p-2 border" value={form.locationUrl} onChange={e => setForm({ ...form, locationUrl: e.target.value })} />
                </div>

                <div className="mt-2 flex flex-col sm:flex-row sm:justify-between sm:items-end gap-2">
                  <div>
                    <div className="text-sm text-gray-500">Subtotal</div>
                    <div className="font-semibold">₹{subtotal}</div>
                    {coupon && <div className="text-sm text-gray-500">Coupon: {coupon.code}</div>}
                    <div className="text-sm text-slate-600">Delivery charge: ₹{deliveryCharge.toFixed(2)}</div>
                    <div className="font-bold text-base mt-1">Total: ₹{subtotal - (coupon?.discount || 0) + deliveryCharge}</div>
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
              <div className="mb-2">
                <strong className="text-sm">Items:</strong>
                <ul className="list-disc pl-5 mt-1 max-h-24 overflow-y-auto text-sm">
                  {cart.items.map((it) => (
                    <li key={it.productId}>{it.title} — {it.qty} × ₹{it.price}</li>
                  ))}
                </ul>
              </div>
              <div className="space-y-1.5 text-sm">
                <input required placeholder="Name*" className="w-full p-2 border rounded" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5"><input required placeholder="Phone*" className="w-full p-2 border rounded" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /><input required placeholder="WhatsApp*" className="w-full p-2 border rounded" value={form.whatsapp} onChange={e => setForm({ ...form, whatsapp: e.target.value })} /></div>
                <input required placeholder="Email*" className="w-full p-2 border rounded" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                <textarea required placeholder="Address*" className="w-full p-2 border rounded" rows={2} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
                <input required placeholder="Location URL (Google Maps) *" className="w-full p-2 border" value={form.locationUrl} onChange={e => setForm({ ...form, locationUrl: e.target.value })} />

                <div className="mt-3 text-right text-sm text-slate-600"><div>Delivery charge: ₹{deliveryCharge.toFixed(2)}</div></div>
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
