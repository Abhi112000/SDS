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
  const [shareLocation, setShareLocation] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [delivery, setDelivery] = useState({ latitude: null, longitude: null, distanceKm: null, charge: 0, error: '' });
  const [differentDeliveryAddress, setDifferentDeliveryAddress] = useState(false);
  const [pincodeVerification, setPincodeVerification] = useState({ loading: false, distanceKm: null, charge: 0, message: '' });
  const [shareLocationManually, setShareLocationManually] = useState(false);
  const [newDeliveryLocation, setNewDeliveryLocation] = useState(false);
  const shopPincode = '201002';

  const shopLatitude = Number(process.env.NEXT_PUBLIC_SHOP_LATITUDE);
  const shopLongitude = Number(process.env.NEXT_PUBLIC_SHOP_LONGITUDE);

  function getDeliveryCharge(distanceKm) {
    if (distanceKm <= 8) return 0;
    if (distanceKm <= 9) return 10;
    if (distanceKm <= 10) return 15;
    if (distanceKm <= 12) return 20;
    return 25;
  }

  function distanceBetween(lat1, lon1, lat2, lon2) {
    const earthRadiusKm = 6371;
    const toRadians = value => value * Math.PI / 180;
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
    return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function requestDeliveryLocation(checked) {
    setShareLocation(checked);
    if (!checked) {
      setDelivery({ latitude: null, longitude: null, distanceKm: null, charge: 0, error: '' });
      return;
    }
    if (!Number.isFinite(shopLatitude) || !Number.isFinite(shopLongitude)) {
      setDelivery(prev => ({ ...prev, error: 'Delivery distance is temporarily unavailable. You can still place the order without sharing location.' }));
      return;
    }
    if (!navigator.geolocation) {
      setDelivery(prev => ({ ...prev, error: 'Location is not supported by this browser.' }));
      return;
    }
    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(position => {
      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;
      const distanceKm = distanceBetween(shopLatitude, shopLongitude, latitude, longitude);
      const locationUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
      setForm(prev => ({ ...prev, locationUrl }));
      setDelivery({ latitude, longitude, distanceKm, charge: getDeliveryCharge(distanceKm), error: '' });
      setLocationLoading(false);
    }, error => {
      setDelivery(prev => ({ ...prev, error: error.code === 1 ? 'Location permission was denied. You can enter the address manually.' : 'Unable to read your location. You can enter the address manually.' }));
      setLocationLoading(false);
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
  }

  function requestNewDeliveryLocation(checked) {
    setNewDeliveryLocation(checked);
    if (!checked) {
      setDelivery(prev => ({ ...prev, latitude: null, longitude: null, distanceKm: null, charge: 0, error: '' }));
      setForm(prev => ({ ...prev, locationUrl: session?.user?.locationUrl || '' }));
      return;
    }
    setDifferentDeliveryAddress(true);
    requestDeliveryLocation(true);
  }

  function updateDeliveryPincode(value) {
    const pincode = value.replace(/\D/g, '').slice(0, 6);
    setForm(prev => ({ ...prev, deliveryPincode: pincode }));
    if (pincode.length === 6 && pincode === shopPincode) {
      setDelivery(prev => ({ ...prev, charge: 0, error: '' }));
    } else if (pincode.length === 6 && pincode !== shopPincode && delivery.distanceKm === null) {
      setDelivery(prev => ({ ...prev, charge: 0, error: 'This pincode is outside the shop pincode. Share delivery location to calculate the exact charge.' }));
    }
  }

  async function verifyDeliveryPincode() {
    if (!/^\d{6}$/.test(form.deliveryPincode)) {
      setPincodeVerification(prev => ({ ...prev, message: 'Enter a valid 6-digit pincode.' }));
      return;
    }
    setPincodeVerification({ loading: true, distanceKm: null, charge: 0, message: '' });
    try {
      const response = await fetch('/api/delivery/verify-pincode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pincode: form.deliveryPincode }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Pincode verification failed');
      setPincodeVerification({ loading: false, distanceKm: data.distanceKm, charge: data.estimatedCharge, message: data.sameShopPincode ? 'Same shop pincode: delivery is free.' : 'This is an approximate pincode distance. Final delivery cost will be confirmed after the delivery address is shared.' });
    } catch (error) {
      setPincodeVerification({ loading: false, distanceKm: null, charge: 0, message: error.message });
    }
  }

  const deliveryCharge = form.deliveryPincode === shopPincode ? 0 : delivery.distanceKm !== null ? Number(delivery.charge || 0) : Number(pincodeVerification.charge || 0);
  const deliveryRoughDistanceKm = delivery.distanceKm !== null ? null : pincodeVerification.distanceKm;

  function ensureDeliveryReady() {
    if (form.deliveryPincode && form.deliveryPincode.length === 6 && form.deliveryPincode !== shopPincode && delivery.distanceKm === null && pincodeVerification.distanceKm === null) {
      toast?.push?.({ message: 'Verify the delivery pincode or share the delivery location before placing the order.', type: 'error' });
      return false;
    }
    return true;
  }

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
    const discount = Number(coupon?.discount || 0);
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
      `Location URL: ${form.locationUrl || ''}`,
      `WhatsApp: ${String(form.whatsapp || '').trim()}`,
      `Delivery pincode: ${form.deliveryPincode || 'Not provided'}`,
      delivery.distanceKm !== null ? `Delivery distance: ${delivery.distanceKm.toFixed(2)} km` : '',
      `Delivery charge: ₹${deliveryCharge.toFixed(2)}`,
      '',
      'Order Items:',
      cartLines || 'No items selected',
      '',
      `Subtotal: ₹${subtotal}`,
      `Discount: -₹${discount}`,
      `Delivery charge: ₹${deliveryCharge.toFixed(2)}`,
      `Total: ₹${total}`
    ].filter(Boolean).join('\n');
      const finalMessage = shareLocationManually
      ? `${message}\n\n*Note: Please share your delivery location so the final delivery fare can be calculated and the invoice can be generated.*`
      : message;

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
      , deliveryLatitude: delivery.latitude, deliveryLongitude: delivery.longitude, deliveryDistanceKm: delivery.distanceKm, deliveryRoughDistanceKm, deliveryLocationPending: shareLocationManually && !delivery.distanceKm, deliveryCharge
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
      // include profile details so admin sees the info
      name: form.name || session?.user?.name || '',
      phone: form.phone || session?.user?.phone || '',
      email: form.email || session?.user?.email || '',
      whatsapp: form.whatsapp || session?.user?.whatsapp || session?.user?.phone || '' ,
      address: form.address || session?.user?.address || '',
      deliveryPincode: form.deliveryPincode,
      locationUrl: form.locationUrl || session?.user?.locationUrl || '',
      deliveryLatitude: delivery.latitude, deliveryLongitude: delivery.longitude, deliveryDistanceKm: delivery.distanceKm, deliveryRoughDistanceKm, deliveryLocationPending: shareLocationManually && !delivery.distanceKm, deliveryCharge
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
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white p-4 sm:p-5 rounded-xl max-w-lg w-full max-h-[calc(100vh-1rem)] sm:max-h-[calc(100vh-2rem)] overflow-y-auto relative shadow-xl">
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
                <div className="rounded border border-slate-200 bg-slate-50 p-2 text-xs"><strong className="block text-sm">User current location</strong><div>{session?.user?.name || form.name || 'Not provided'}</div><div>{session?.user?.phone || form.phone || 'Not provided'} • {session?.user?.email || form.email || 'Not provided'}</div><div>{session?.user?.address || form.address || 'No saved address'}</div>{(session?.user?.locationUrl || form.locationUrl) && <a href={session?.user?.locationUrl || form.locationUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline">Open saved location</a>}</div>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={newDeliveryLocation} onChange={e=>requestNewDeliveryLocation(e.target.checked)} /> Need delivery at a new location</label>
                {newDeliveryLocation && <div className="rounded border border-blue-200 bg-blue-50 p-2 text-xs text-blue-800"><strong className="block text-sm">New delivery location</strong><span>We will use your current device location for this delivery.</span>{form.locationUrl && <a href={form.locationUrl} target="_blank" rel="noreferrer" className="block mt-1 underline break-all">{form.locationUrl}</a>}</div>}
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={differentDeliveryAddress} onChange={e=>{ setDifferentDeliveryAddress(e.target.checked); if(!e.target.checked) { setForm(prev=>({...prev, name: session?.user?.name || prev.name, phone: session?.user?.phone || prev.phone, address: session?.user?.address || prev.address, deliveryPincode: '' })); setPincodeVerification({ loading:false, distanceKm:null, charge:0, message:'' }); setShareLocationManually(false); } }} /> Delivery location is different</label>
                {differentDeliveryAddress && <>
                <input placeholder="Delivery recipient name" className="w-full p-2 border rounded" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5"><input placeholder="Delivery phone" className="w-full p-2 border rounded" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /><input placeholder="WhatsApp" className="w-full p-2 border rounded" value={form.whatsapp} onChange={e => setForm({ ...form, whatsapp: e.target.value })} /></div>
                <input placeholder="Email" className="w-full p-2 border rounded" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                <textarea placeholder="Delivery address" className="w-full p-2 border rounded" rows={2} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
                <div className="flex gap-2"><input inputMode="numeric" placeholder="Delivery pincode" className="min-w-0 flex-1 p-2 border rounded" value={form.deliveryPincode} onChange={e=>updateDeliveryPincode(e.target.value)} /><button type="button" onClick={verifyDeliveryPincode} disabled={pincodeVerification.loading} className="px-3 py-2 border rounded">{pincodeVerification.loading ? 'Checking...' : 'Verify pincode'}</button></div>
                {pincodeVerification.message && <div className="rounded bg-blue-50 p-2 text-xs text-blue-800">{pincodeVerification.message}</div>}
                {form.deliveryPincode && form.deliveryPincode !== shopPincode && <div className="rounded border border-slate-200 p-2 text-xs"><strong>Estimated delivery charges</strong><div>0–8 km: ₹0 • 8–9 km: ₹10 • 9–10 km: ₹15</div><div>10–12 km: ₹20 • 12–15 km: ₹25</div><div className="mt-1">Estimated charge: ₹{deliveryCharge}. Final cost will be confirmed after the address is shared.</div></div>}
                </>}
                <input placeholder="Location URL (optional)" className="w-full p-2 border" value={form.locationUrl} onChange={e => setForm({ ...form, locationUrl: e.target.value })} />
                {differentDeliveryAddress && form.deliveryPincode !== shopPincode && <label className="flex items-start gap-2 rounded border border-slate-200 bg-slate-50 p-2 text-xs"><input type="checkbox" checked={shareLocationManually} onChange={e=>setShareLocationManually(e.target.checked)} className="mt-0.5" /><span><strong className="block text-sm">Share location on WhatsApp manually</strong><span className="block text-slate-600">No browser location will be requested. Required for the final delivery fare and invoice.</span></span></label>}

                <div className="mt-2 flex flex-col sm:flex-row sm:justify-between sm:items-end gap-2">
                  <div>
                    <div className="text-sm text-gray-500">Subtotal</div>
                    <div className="font-semibold">₹{subtotal}</div>
                    {coupon && <div className="text-sm text-gray-500">Coupon: {coupon.code}</div>}
                    {delivery.distanceKm !== null && <div className="text-sm text-slate-600 mt-2">Delivery distance: {delivery.distanceKm.toFixed(2)} km</div>}
                    {deliveryRoughDistanceKm !== null && <div className="text-sm text-slate-600 mt-2">Approximate pincode distance: {deliveryRoughDistanceKm.toFixed(2)} km</div>}
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
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={differentDeliveryAddress} onChange={e=>setDifferentDeliveryAddress(e.target.checked)} /> Delivery location is different</label>
                {differentDeliveryAddress && <><div className="flex gap-2"><input required inputMode="numeric" placeholder="Delivery pincode*" className="min-w-0 flex-1 p-2 border rounded" value={form.deliveryPincode} onChange={e=>updateDeliveryPincode(e.target.value)} /><button type="button" onClick={verifyDeliveryPincode} disabled={pincodeVerification.loading} className="px-3 py-2 border rounded">{pincodeVerification.loading ? 'Checking...' : 'Verify pincode'}</button></div>{pincodeVerification.message && <div className="rounded bg-blue-50 p-2 text-xs text-blue-800">{pincodeVerification.message}</div>}{form.deliveryPincode && form.deliveryPincode !== shopPincode && <div className="rounded border border-slate-200 p-2 text-xs"><strong>Estimated delivery charges</strong><div>0–8 km: ₹0 • 8–9 km: ₹10 • 9–10 km: ₹15</div><div>10–12 km: ₹20 • 12–15 km: ₹25</div><div className="mt-1">Estimated charge: ₹{deliveryCharge}. Final cost will be confirmed after the address is shared.</div></div>}</>}
                <input required placeholder="Location URL (Google Maps) *" className="w-full p-2 border" value={form.locationUrl} onChange={e => setForm({ ...form, locationUrl: e.target.value })} />
                {differentDeliveryAddress && form.deliveryPincode !== shopPincode && <label className="flex items-start gap-2 rounded border border-slate-200 bg-slate-50 p-2 text-xs"><input type="checkbox" checked={shareLocationManually} onChange={e=>setShareLocationManually(e.target.checked)} className="mt-0.5" /><span><strong className="block text-sm">Share location on WhatsApp manually</strong><span className="block text-slate-600">No browser location will be requested. Required for the final delivery fare and invoice.</span></span></label>}

                <div className="mt-3 text-right text-sm text-slate-600">{delivery.distanceKm !== null && <div>Delivery distance: {delivery.distanceKm.toFixed(2)} km</div>}<div>Delivery charge: ₹{deliveryCharge.toFixed(2)}</div></div>
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
