import Link from "next/link";
import { useToast } from '@/components/Toast';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

export default function Footer() {
  const toast = useToast();
  const { data: session } = useSession();
  const [liveUsers, setLiveUsers] = useState(0);
  const [isActive, setIsActive] = useState(true);

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
        const data = await res.json().catch(() => ({}));
        if (!mounted) return;
        setIsActive(Boolean(data.enabled !== false));
        if (typeof data.count === 'number') setLiveUsers(data.count);
      } catch (e) {
        if (mounted) setLiveUsers(0);
      }
    };

    const loadCurrentCount = async () => {
      try {
        const res = await fetch('/api/visitors', { credentials: 'include' });
        const data = await res.json().catch(() => ({}));
        if (!mounted) return;
        setIsActive(Boolean(data.enabled !== false));
        if (typeof data.count === 'number') setLiveUsers(data.count);
      } catch (e) {
        if (mounted) setLiveUsers(0);
      }
    };

    loadCurrentCount();
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
    <footer className="mt-10 border-t border-slate-100 bg-[#fffdfb]">
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-10 grid md:grid-cols-3 gap-6 md:gap-7 bg-gradient-to-br from-white via-slate-50 to-red-50/60 border border-gray-100 text-slate-700 rounded-[1.75rem] items-start shadow-[0_18px_38px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-3">
          <Link href="/" className="flex items-center gap-3">
            <img src="/images/logo.jpeg" alt="Shree Durga" className="h-12 w-auto object-contain" />
            <div>
              <h3 className="text-xl font-bold text-slate-900">Shree Durga</h3>
              <div className="text-sm text-muted">Stationary</div>
            </div>
          </Link>
          <p className="text-sm leading-6 text-slate-600">New Friends Colony, Sector 23, Sanjay Nagar, Ghaziabad, Uttar Pradesh 201002</p>
          <Link href="https://maps.app.goo.gl/6qNXoHM1YoV3hQVXA" target="_blank" className="text-primary hover:underline block mt-1 text-sm font-semibold">View on Map</Link>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-3 text-slate-900">Quick Links</h3>
          <ul className="space-y-2 text-sm">
            <li><Link href="/" className="text-slate-600 hover:text-primary hover:underline">Home</Link></li>
            <li><Link href="/shop" className="text-slate-600 hover:text-primary hover:underline">Shop</Link></li>
            <li><Link href="/contact" className="text-slate-600 hover:text-primary hover:underline">Contact</Link></li>
            <li><Link href="/cart" className="text-slate-600 hover:text-primary hover:underline">Cart</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-3 text-slate-900">Contact & Newsletter</h3>
          <p className="text-sm leading-6">Email: <a href="mailto:contact.sdstationary@gmail.com" className="underline text-primary hover:text-slate-800">contact.sdstationary@gmail.com</a></p>
          <p className="text-sm mt-2 leading-6">Phone: <a href="tel:+919818630972" className="text-slate-700 hover:text-primary">9818630972</a>, <a href="tel:+918077148123" className="text-slate-700 hover:text-primary">8077148123</a></p>

          <form onSubmit={(e)=>{ e.preventDefault(); toast?.push?.({ message: 'Subscribed — demo only', type: 'success' }); }} className="mt-4 flex gap-2">
            <input type="email" placeholder="Your email" required className="form-field flex-1 min-w-0" />
            <button type="submit" className="px-4 py-2 rounded-md btn-primary">Subscribe</button>
          </form>

          {isActive && (
            <div className="mt-4 flex items-center justify-start gap-2 text-sm text-slate-600">
              <span className="inline-flex h-3 w-3 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.15)]" />
              <span>Live shoppers</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white shadow-sm ring-2 ring-red-100">
                {liveUsers}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="text-center mt-6 text-sm text-gray-500">© {new Date().getFullYear()} Shree Durga Stationary. All rights reserved.</div>
    </footer>
  );
}
