import { getSession, useSession } from 'next-auth/react';
import { useState } from 'react';
import { useRouter } from 'next/router';
import { useToast } from '@/components/Toast';
import AdminSidebar from '@/components/AdminSidebar';
import { authRedirect } from '@/lib/authRedirect';

export default function AdminProfile({ user }) {
  const { data: session } = useSession();
  const router = useRouter();
  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    address: user?.address || '',
    locationUrl: user?.locationUrl || ''
  });

  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const save = async () => {
    try{
      setLoading(true);
      const res = await fetch('/api/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(form) });
      if(!res.ok) throw new Error('Save failed');
      toast?.push?.({ title: 'Profile updated', message: 'Your profile changes were saved', type: 'success' });
    }catch(e){ console.error(e); toast?.push?.({ title: 'Save failed', message: 'Something went wrong while saving profile', type: 'error' }); }
    setLoading(false);
  };

  return (
    <div className="p-6">
      <div className="grid md:grid-cols-4 gap-6">
        <AdminSidebar />
        <main className="md:col-span-3">
          <h1 className="text-2xl font-bold mb-4">Admin Profile</h1>
          <div className="bg-white p-4 rounded shadow max-w-lg">
            <label className="block mb-2 font-medium">Full Name</label>
            <input className="w-full p-2 border mb-4 rounded" value={form.name} onChange={(e)=>setForm({...form, name: e.target.value})} placeholder="Your name" />

            <label className="block mb-2 font-medium">Email</label>
            <input className="w-full p-2 border mb-4 rounded bg-gray-100 cursor-not-allowed" value={form.email} readOnly />

            <label className="block mb-2 font-medium">Phone</label>
            <input className="w-full p-2 border mb-4 rounded" value={form.phone} onChange={(e)=>setForm({...form, phone: e.target.value})} placeholder="Your phone number" />

            <label className="block mb-2 font-medium">Home Address</label>
            <input className="w-full p-2 border mb-4 rounded" value={form.address} onChange={(e)=>setForm({...form, address: e.target.value})} placeholder="Your address" />

            <label className="block mb-2 font-medium">Location URL</label>
            <input className="w-full p-2 border mb-4 rounded" value={form.locationUrl} onChange={(e)=>setForm({...form, locationUrl: e.target.value})} placeholder="Paste your Google Map URL" />

            <div className="flex items-center gap-2">
              <button onClick={save} disabled={loading} className={`px-4 py-2 rounded text-white ${loading ? 'bg-gray-400' : 'btn-primary'}`}>{loading ? 'Saving...' : 'Save'}</button>
              <button onClick={()=>router.push('/admin')} className="px-3 py-2 border rounded">Back</button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export async function getServerSideProps(ctx){
  const session = await getSession(ctx);
  if(!session || session.user?.role !== 'admin') return authRedirect(ctx);
  return { props: { user: session.user } };
}