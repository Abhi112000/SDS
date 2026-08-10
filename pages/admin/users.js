import { getSession } from 'next-auth/react';
import AdminSidebar from '@/components/AdminSidebar';
import { useEffect, useState } from 'react';
import { useToast } from '@/components/Toast';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState({});
  const toast = useToast();

  async function load() {
    try {
      const response = await fetch('/api/admin/users', { credentials: 'include' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to load users');
      setUsers(data.users || []);
    } catch (error) {
      toast?.push?.({ message: error.message || 'Unable to load users', type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function updateUser(id, patch) {
    setBusy(prev => ({ ...prev, [id]: true }));
    try {
      const response = await fetch('/api/admin/users', { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...patch }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Update failed');
      setUsers(prev => prev.map(user => user._id === id ? { ...user, ...patch } : user));
      toast?.push?.({ message: 'User updated', type: 'success' });
    } catch (error) {
      toast?.push?.({ message: error.message || 'Update failed', type: 'error' });
    } finally {
      setBusy(prev => ({ ...prev, [id]: false }));
    }
  }

  async function deleteUser(id) {
    if (!window.confirm('Delete this user permanently?')) return;
    setBusy(prev => ({ ...prev, [id]: true }));
    try {
      const response = await fetch(`/api/admin/users?id=${id}`, { method: 'DELETE', credentials: 'include' });
      if (!response.ok) throw new Error('Delete failed');
      setUsers(prev => prev.filter(user => user._id !== id));
      toast?.push?.({ message: 'User deleted', type: 'success' });
    } catch (error) {
      toast?.push?.({ message: error.message || 'Delete failed', type: 'error' });
    } finally {
      setBusy(prev => ({ ...prev, [id]: false }));
    }
  }

  const filteredUsers = users.filter(user => JSON.stringify(user).toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <div className="p-6">
      <div className="grid md:grid-cols-4 gap-6">
        <AdminSidebar />
        <main className="md:col-span-3">
          <div className="flex items-center justify-between mb-4"><h1 className="text-2xl font-bold">Users</h1><a href="/admin" className="px-3 py-1 bg-gray-100 rounded">Back</a></div>
          <div className="bg-white p-4 rounded shadow">
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search name, email or role..." className="w-full p-2 border rounded mb-4" />
            {loading ? <div>Loading...</div> : <div className="overflow-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">Name</th><th className="p-2">Email</th><th className="p-2">Role</th><th className="p-2">Actions</th></tr></thead><tbody>{filteredUsers.map(user => <tr key={user._id} className="border-b"><td className="p-2">{user.name || '-'}</td><td className="p-2">{user.email}</td><td className="p-2"><select value={user.role} onChange={event => updateUser(user._id, { role: event.target.value })} className="p-1 border rounded"><option value="user">user</option><option value="admin">admin</option></select></td><td className="p-2"><label className="mr-3"><input type="checkbox" checked={!!user.disabled} onChange={event => updateUser(user._id, { disabled: event.target.checked })} /> Disabled</label><button disabled={busy[user._id]} onClick={() => deleteUser(user._id)} className="text-red-600">Delete</button></td></tr>)}</tbody></table></div>}
          </div>
        </main>
      </div>
    </div>
  );
}

export async function getServerSideProps(ctx) {
  const session = await getSession(ctx);
  if (!session || session.user?.role !== 'admin') return { redirect: { destination: '/login', permanent: false } };
  return { props: {} };
}
