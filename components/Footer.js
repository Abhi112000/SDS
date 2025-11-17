import Link from "next/link";
import { useToast } from '@/components/Toast';

export default function Footer() {
  const toast = useToast();
  return (
    <footer className="mt-16">
      <div className="max-w-7xl mx-auto px-4 py-12 grid md:grid-cols-3 gap-6 bg-white border border-gray-100 text-slate-700 rounded-2xl items-start">
        <div className="flex flex-col gap-3">
          <Link href="/" className="flex items-center gap-3">
            <img src="/images/logo.jpeg" alt="Shree Durga" className="h-12 w-auto object-contain" />
            <div>
              <h3 className="text-xl font-bold">Shree Durga</h3>
              <div className="text-sm text-muted">Stationary</div>
            </div>
          </Link>
          <p className="text-sm">New Friends Colony, Sector 23, Sanjay Nagar, Ghaziabad, Uttar Pradesh 201002</p>
          <Link href="https://maps.app.goo.gl/6qNXoHM1YoV3hQVXA" target="_blank" className="text-secondary hover:underline block mt-1 text-sm">View on Map</Link>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-2">Quick Links</h3>
          <ul className="space-y-1 text-sm">
            <li><Link href="/" className="text-slate-600 hover:text-slate-800">Home</Link></li>
            <li><Link href="/shop" className="text-slate-600 hover:text-slate-800">Shop</Link></li>
            <li><Link href="/contact" className="text-slate-600 hover:text-slate-800">Contact</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-2">Contact & Newsletter</h3>
          <p className="text-sm">Email: <a href="mailto:contact.sdstationary@gmail.com" className="underline">contact.sdstationary@gmail.com</a></p>
          <p className="text-sm">Phone: 9818630972, 8077148123</p>

          <form onSubmit={(e)=>{ e.preventDefault(); toast?.push?.({ message: 'Subscribed — demo only', type: 'success' }); }} className="mt-3 flex gap-2">
            <input type="email" placeholder="Your email" required className="flex-1 px-3 py-2 border rounded-md" />
            <button className="px-4 py-2 rounded-md bg-primary text-white">Subscribe</button>
          </form>
        </div>
      </div>

      <div className="text-center mt-6 text-sm text-gray-500">© {new Date().getFullYear()} Shree Durga Stationary. All rights reserved.</div>
    </footer>
  );
}
