import Link from "next/link";
import { useToast } from '@/components/Toast';

export default function Footer() {
  const toast = useToast();
  return (
    <footer className="mt-16 border-t border-slate-100 bg-[#fffdfb]">
      <div className="max-w-7xl mx-auto px-4 py-12 grid md:grid-cols-3 gap-8 bg-white/80 border border-gray-100 text-slate-700 rounded-2xl items-start shadow-sm">
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
        </div>
      </div>

      <div className="text-center mt-6 text-sm text-gray-500">© {new Date().getFullYear()} Shree Durga Stationary. All rights reserved.</div>
    </footer>
  );
}
