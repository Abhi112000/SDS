import Link from "next/link";
import { useEffect } from 'react';
import { useSession } from 'next-auth/react';

export default function Footer() {
  const { data: session } = useSession();

  useEffect(() => {
    let mounted = true;
    const createSessionId = () => {
      const saved = window.localStorage.getItem('sd_visitor_session');
      if (saved) return saved;
      const next = `guest-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      window.localStorage.setItem('sd_visitor_session', next);
      return next;
    };

    const detectDeviceType = () => {
      if (typeof window === 'undefined') return 'desktop';
      const width = window.innerWidth;
      if (width < 768) return 'phone';
      if (width < 1024) return 'tablet';
      const ua = navigator.userAgent || '';
      if (/Mac|Win|Linux/i.test(ua)) return 'laptop';
      return 'desktop';
    };

    const sendHeartbeat = async (action = 'heartbeat', label = '') => {
      try {
        const sessionId = createSessionId();
        const res = await fetch('/api/visitors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            action,
            page: window.location.pathname || '/',
            title: document.title || window.location.pathname || '/',
            label,
            deviceType: detectDeviceType(),
            userAgent: navigator.userAgent || '',
            userId: session?.user?.id || null,
            userName: session?.user?.name || '',
            email: session?.user?.email || ''
          })
        });
        if (!res.ok) throw new Error(`Visitor tracking failed with status ${res.status}`);
        if (!mounted) return;
      } catch (e) {
        if (mounted) console.error('visitor heartbeat failed', e);
      }
    };

    sendHeartbeat('heartbeat');
    const interval = setInterval(() => sendHeartbeat('heartbeat'), 20000);
    const handleClicks = (event) => {
      const target = event.target;
      if (!target || !(target instanceof HTMLElement)) return;
      const clickable = target.closest('a, button, input, select, textarea');
      if (!clickable) return;
      const label = clickable.getAttribute('aria-label') || clickable.textContent || clickable.getAttribute('name') || clickable.tagName;
      sendHeartbeat('click', label.trim().slice(0, 80));
    };
    const leave = () => {
      const sessionId = window.localStorage.getItem('sd_visitor_session');
      if (sessionId) {
        fetch('/api/visitors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, action: 'leave', page: window.location.pathname || '/', title: document.title || '/', deviceType: detectDeviceType(), userAgent: navigator.userAgent || '', userId: session?.user?.id || null, userName: session?.user?.name || '', email: session?.user?.email || '' })
        }).catch(() => null);
      }
    };

    document.addEventListener('click', handleClicks, true);
    window.addEventListener('beforeunload', leave);
    return () => {
      mounted = false;
      clearInterval(interval);
      document.removeEventListener('click', handleClicks, true);
      window.removeEventListener('beforeunload', leave);
      leave();
    };
  }, [session?.user?.id, session?.user?.name, session?.user?.email]);

  return (
    <footer className="mt-6 border-t border-slate-100 bg-[#fffdfb]">
      <div className="max-w-7xl mx-auto px-4 py-5 md:py-6 grid sm:grid-cols-3 gap-4 md:gap-6 text-slate-700">
        <div className="flex flex-col gap-2">
          <Link href="/" className="flex items-center gap-2">
            <img src="/images/logo.jpeg" alt="Shree Durga" className="h-9 w-auto object-contain" />
            <div>
              <h3 className="text-base font-bold text-slate-900">Shree Durga</h3>
              <div className="text-xs text-muted">Stationery</div>
            </div>
          </Link>
          <p className="text-xs leading-5 text-slate-600">New Friends Colony, Sector 23, Sanjay Nagar, Ghaziabad, Uttar Pradesh 201002</p>
          <Link href="https://maps.app.goo.gl/6qNXoHM1YoV3hQVXA" target="_blank" className="text-primary hover:underline text-xs font-semibold">View on Map</Link>
        </div>

        <div>
          <h3 className="text-sm font-semibold mb-2 text-slate-900">Quick Links</h3>
          <ul className="space-y-1 text-xs">
            <li><Link href="/" className="text-slate-600 hover:text-primary hover:underline">Home</Link></li>
            <li><Link href="/shop" className="text-slate-600 hover:text-primary hover:underline">Shop</Link></li>
            <li><Link href="/contact" className="text-slate-600 hover:text-primary hover:underline">Contact</Link></li>
            <li><Link href="/cart" className="text-slate-600 hover:text-primary hover:underline">Cart</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold mb-2 text-slate-900">Contact</h3>
          <p className="text-xs leading-5">Email: <a href="mailto:contact.sdstationary@gmail.com" className="underline text-primary hover:text-slate-800">contact.sdstationary@gmail.com</a></p>
          <p className="text-xs mt-1 leading-5">Phone: <a href="tel:+919818630972" className="text-slate-700 hover:text-primary">9818630972</a>, <a href="tel:+918077148123" className="text-slate-700 hover:text-primary">8077148123</a></p>
        </div>
      </div>

      <div className="text-center py-2 text-[11px] text-gray-500">© {new Date().getFullYear()} Shree Durga Stationery. All rights reserved.</div>
    </footer>
  );
}
