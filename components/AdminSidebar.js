import Link from 'next/link';

export default function AdminSidebar(){
  return (
    <aside className="md:col-span-1">
      <div className="bg-white p-4 rounded shadow sticky top-6">
        <div className="mb-4">
          <div className="font-bold text-lg">Admin</div>
          <div className="text-sm text-gray-600">Welcome back</div>
        </div>
        <nav className="space-y-2 text-sm">
          <Link href="/admin" className="block px-3 py-2 rounded hover:bg-gray-50">Dashboard</Link>
          <Link href="/admin/orders" className="block px-3 py-2 rounded hover:bg-gray-50">Orders</Link>
          <Link href="/admin/products" className="block px-3 py-2 rounded hover:bg-gray-50">Products</Link>
          <Link href="/admin/coupons" className="block px-3 py-2 rounded hover:bg-gray-50">Coupons</Link>
          <Link href="/admin/messages" className="block px-3 py-2 rounded hover:bg-gray-50">Messages</Link>
          <Link href="/admin" className="block px-3 py-2 rounded hover:bg-gray-50">Invoices</Link>
          <Link href="/admin/profile" className="block px-3 py-2 rounded hover:bg-gray-50">Profile</Link>
        </nav>
      </div>
    </aside>
  );
}
