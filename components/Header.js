import Link from 'next/link';
import { useEffect, useState, useContext, useRef } from 'react';
import useFocusTrap from '../hooks/useFocusTrap';
import { signOut, useSession } from 'next-auth/react';
import { CartContext } from './CartContext';

export default function Header(){
  const { data: session } = useSession();
  const { cart, remove, subtotal } = useContext(CartContext);
  const [cartCount, setCartCount] = useState(0);
  const [showCartPreview, setShowCartPreview] = useState(false);
  const cartRef = useRef();
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileMenuRef = useRef();
  const [isNarrow, setIsNarrow] = useState(false); // true when viewport < 1200px
  const [unread, setUnread] = useState(0);
  const MENU_ID = 'main-navigation';
  const mobileToggleRef = useRef();
  const prevMobileOpenRef = useRef(mobileOpen);

  useEffect(()=>{
    // set initial cart count from localStorage (persisted cart)
    try{
      const raw = localStorage.getItem('sd_cart');
      if(raw){ const c = JSON.parse(raw); setCartCount((c.items||[]).reduce((s,i)=>s + (i.qty||0), 0)); }
    }catch(e){}

    const onUpdate = ()=>{
      try{ const raw = localStorage.getItem('sd_cart'); if(raw){ const c=JSON.parse(raw); setCartCount((c.items||[]).reduce((s,i)=>s + (i.qty||0),0)); } }
      catch(e){}
    };

    window.addEventListener('sd_cart_updated', onUpdate);
    window.addEventListener('storage', onUpdate);
    return ()=>{ window.removeEventListener('sd_cart_updated', onUpdate); window.removeEventListener('storage', onUpdate); };
  },[]);

  useEffect(()=>{ setCartCount(cart?.items?.reduce((s,i)=>s + (i.qty||0),0) || 0); },[cart]);

  // close cart preview when clicking outside
  useEffect(()=>{
    function onDoc(e){ if(cartRef.current && !cartRef.current.contains(e.target)){ setShowCartPreview(false); } if(mobileOpen && mobileMenuRef.current && !mobileMenuRef.current.contains(e.target) && !e.target.closest('[data-mobile-toggle]')){ setMobileOpen(false); } }
    function onKey(e){ if(e.key === 'Escape'){ setShowCartPreview(false); setMobileOpen(false); } }
    if(showCartPreview || mobileOpen){ document.addEventListener('click', onDoc); document.addEventListener('keydown', onKey); }
    return ()=>{ document.removeEventListener('click', onDoc); document.removeEventListener('keydown', onKey); };
  },[showCartPreview, mobileOpen]);

  // Use reusable focus trap hook to keep focus within the mobile menu while open
  useFocusTrap(mobileMenuRef, mobileOpen, { initialFocus: true });

  // Restore focus to the mobile toggle button when the menu closes
  useEffect(()=>{
    if(prevMobileOpenRef.current && !mobileOpen){
      try{ mobileToggleRef.current?.focus(); }catch(e){}
    }
    prevMobileOpenRef.current = mobileOpen;
  },[mobileOpen]);

  // track a custom breakpoint (1200px) so we can control dropdown behavior precisely
  useEffect(()=>{
    function update(){ try{ setIsNarrow(window.innerWidth < 1200); }catch(e){} }
    update();
    window.addEventListener('resize', update);
    return ()=> window.removeEventListener('resize', update);
  },[]);

  // prevent body scroll when mobile dropdown is open
  useEffect(()=>{
    if(isNarrow && mobileOpen){ document.body.style.overflow = 'hidden'; }
    else { document.body.style.overflow = ''; }
    return ()=>{ document.body.style.overflow = ''; };
  },[isNarrow, mobileOpen]);

  // If the viewport becomes wide, ensure mobile menu is closed
  useEffect(()=>{ if(!isNarrow && mobileOpen) setMobileOpen(false); },[isNarrow]);

  useEffect(()=>{
    let mounted = true;
    if(!session?.user) return;
    fetch('/api/messages')
      .then(r=>r.json()).then(data=>{ if(mounted){ setUnread((data||[]).filter(m=>!m.read).length); } })
      .catch(()=>{});
    return ()=>{ mounted=false };
  },[session]);

  return (
    <header className="sticky top-0 z-50 border-b border-white/50 bg-white/90 backdrop-blur-xl shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between relative">
        <nav role="navigation" aria-label="Main navigation" className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3 group" aria-label="Go to homepage">
            <span className="relative flex items-center justify-center h-12 w-12 rounded-full bg-gradient-to-br from-red-50 to-sky-50 border border-white shadow-sm">
              <img src="/images/logo.jpeg" alt="Shree Durga Stationery logo" className="h-11 w-11 object-contain rounded-full" />
            </span>
            <div className="leading-none">
              <div className="text-xl font-extrabold tracking-tight text-slate-900 group-hover:text-primary transition-colors">Shree Durga</div>
              <span className="text-xs block font-semibold text-slate-500 mt-1 uppercase tracking-[0.17em]">Stationery</span>
            </div>
          </Link>
        </nav>

        <div className="flex items-center gap-4">
          {isNarrow ? (
            <>
              <button
                ref={mobileToggleRef}
                data-mobile-toggle
                aria-expanded={mobileOpen}
                aria-controls={MENU_ID}
                onClick={()=>setMobileOpen(s=>!s)}
                className="px-3 py-2 border rounded flex items-center justify-center text-slate-700 hover:bg-slate-50"
                aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              >
                {!mobileOpen ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                    <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                    <path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>

              <nav id={MENU_ID} ref={mobileMenuRef} aria-hidden={!mobileOpen} aria-label="Primary" className={`${mobileOpen ? 'block' : 'hidden'} w-full` }>
                <div className={`${mobileOpen ? 'absolute left-0 right-0 top-full bg-white border-t p-4 z-40 shadow-xl' : ''}`}>
                  <div className="flex flex-col gap-2 w-full">
                    <Link href="/shop" onClick={()=>setMobileOpen(false)} className="text-slate-700 hover:text-primary hover:bg-slate-50 rounded-md px-3 py-2 block" aria-label="Shop">Shop</Link>
                    <Link href="/contact" onClick={()=>setMobileOpen(false)} className="text-slate-700 hover:text-primary hover:bg-slate-50 rounded-md px-3 py-2 block" aria-label="Contact">Contact</Link>
                    {session && session.user?.role !== 'admin' && (
                      <Link href="/messages" onClick={()=>setMobileOpen(false)} className="text-slate-700 hover:text-primary hover:bg-slate-50 rounded-md px-3 py-2 block" aria-label="Messages">Messages</Link>
                    )}
                    <Link href="/cart" onClick={()=>setMobileOpen(false)} className="text-slate-700 hover:text-primary hover:bg-slate-50 rounded-md px-3 py-2 block" aria-label="Cart">Cart</Link>

                    {session ? (
                      <>
                        {session.user?.role === 'admin' && (
                          <Link href="/admin" onClick={()=>setMobileOpen(false)} className="text-slate-700 hover:text-primary hover:bg-slate-50 rounded-md px-3 py-2 block" aria-label="Admin">Admin{unread?` (${unread})`:''}</Link>
                        )}
                        <Link href="/dashboard" onClick={()=>setMobileOpen(false)} className="text-slate-700 hover:text-primary hover:bg-slate-50 rounded-md px-3 py-2 block" aria-label="Dashboard">Dashboard</Link>
                        <Link href="/profile" onClick={()=>setMobileOpen(false)} className="text-slate-700 hover:text-primary hover:bg-slate-50 rounded-md px-3 py-2 block" aria-label="Profile">Profile</Link>
                        <button onClick={() => { setMobileOpen(false); signOut(); }} className="text-slate-700 text-left block hover:text-primary hover:bg-slate-50 rounded-md px-3 py-2" aria-label="Logout">Logout</button>
                      </>
                    ) : (
                      <Link href="/login" onClick={()=>setMobileOpen(false)} className="text-slate-700 hover:text-primary hover:bg-slate-50 rounded-md px-3 py-2 block" aria-label="Login">Login</Link>
                    )}
                  </div>
                </div>
              </nav>
            </>
          ) : (
            <nav id={MENU_ID} ref={mobileMenuRef} aria-hidden={false} className={`flex items-center gap-6`} aria-label="Primary">
              <Link href="/shop" className="text-slate-700 hover:text-primary font-semibold text-sm transition-colors" aria-label="Shop">Shop</Link>
              <Link href="/contact" className="text-slate-700 hover:text-primary font-semibold text-sm transition-colors" aria-label="Contact">Contact</Link>
              {session && session.user?.role !== 'admin' && <Link href="/messages" className="text-slate-700 hover:text-primary font-semibold text-sm transition-colors" aria-label="Messages">Messages</Link>}
            </nav>
          )}

          {!isNarrow && (
            <>
              <div className="relative" ref={cartRef}>
                <button onClick={()=>setShowCartPreview(s=>!s)} className="text-slate-700 hover:text-primary relative px-2 py-1 flex items-center gap-2 font-semibold text-sm transition-colors" aria-haspopup="dialog" aria-label="Open cart">
                  <span>Cart</span>
                  {cartCount? <span className="ml-1 inline-flex items-center justify-center min-w-[24px] h-6 px-2 bg-primary text-white text-xs rounded-full font-bold">{cartCount}</span>:null}
                </button>

                {showCartPreview && (
                  <div role="dialog" aria-label="Cart preview" aria-modal="false" className="absolute right-0 mt-2 w-72 bg-white border rounded shadow-lg z-50">
                    <div className="p-3">
                      <div className="font-semibold">Cart ({cartCount})</div>
                      {cart.items.length===0 ? (
                        <div className="text-sm text-muted mt-2">Your cart is empty</div>
                      ) : (
                        <ul className="mt-2 space-y-2 max-h-56 overflow-auto">
                          {cart.items.map(it=> (
                            <li key={it.productId} className="flex justify-between items-start gap-2">
                              <div className="flex items-start gap-2">
                                <img src={it.image||'/images/sample1.svg'} alt={it.title} className="w-12 h-12 object-contain rounded" />
                                <div>
                                  <div className="text-sm font-medium">{it.title}</div>
                                  <div className="text-xs text-gray-500">₹{it.price} × {it.qty}</div>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-2">
                                <button onClick={()=>remove(it.productId)} className="text-sm text-red-600" aria-label={`Remove ${it.title}`}>Remove</button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}

                      <div className="mt-3 border-t pt-3 flex items-center justify-between">
                        <div>
                          <div className="text-sm text-gray-500">Subtotal</div>
                          <div className="font-semibold">₹{subtotal}</div>
                          {cart.coupon && <div className="text-sm text-gray-500">Coupon {cart.coupon.code}: -₹{cart.coupon.discount}</div>}
                          {cart.coupon && <div className="font-bold">Total: ₹{subtotal - (cart.coupon?.discount || 0)}</div>}
                        </div>
                        <div className="flex flex-col items-end">
                          <Link href="/cart" className="px-3 py-2 btn-primary rounded text-white" aria-label="View cart">View Cart</Link>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {session ? (
                <>
                  {session.user?.role === 'admin' && (
                    <Link href="/admin" className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-700 text-sm font-semibold">Admin{unread?` (${unread})`:''}</Link>
                  )}
                  <Link href="/dashboard" className="px-3 py-2 bg-slate-50 hover:bg-slate-100 rounded-full text-slate-700 text-sm font-semibold">Dashboard</Link>
                  <Link href="/profile" className="px-3 py-2 bg-slate-50 hover:bg-slate-100 rounded-full text-slate-700 text-sm font-semibold">Profile</Link>
                  <button onClick={() => signOut()} className="ml-2 px-3 py-2 bg-slate-50 hover:bg-slate-100 rounded-full text-slate-700 text-sm font-semibold">Logout</button>
                </>
              ) : (
                <Link href="/login" className="px-4 py-2 rounded-full bg-slate-900 text-white text-sm font-semibold hover:bg-primary transition-colors">Login</Link>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
}
