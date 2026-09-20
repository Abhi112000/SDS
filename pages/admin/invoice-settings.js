import { getSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import AdminSidebar from '@/components/AdminSidebar';
import { authRedirect } from '@/lib/authRedirect';

export default function InvoiceSettingsPage() {
  const [invoiceSettings, setInvoiceSettings] = useState(null);
  const [settingsDraft, setSettingsDraft] = useState(null);
  const [editingSettings, setEditingSettings] = useState(false);
  const [settingsBusy, setSettingsBusy] = useState(false);

  useEffect(() => {
    fetch('/api/admin/invoice-settings', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        setInvoiceSettings(data || {});
        setSettingsDraft(data || {});
      })
      .catch(() => {});
  }, []);

  async function saveSettings() {
    setSettingsBusy(true);
    try {
      const res = await fetch('/api/admin/invoice-settings', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsDraft)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Settings save failed');
      setInvoiceSettings(data);
      setSettingsDraft(data);
      setEditingSettings(false);
    } catch (error) {
      alert(error.message || 'Settings save failed');
    } finally {
      setSettingsBusy(false);
    }
  }

  return (
    <div className="p-6">
      <div className="grid md:grid-cols-4 gap-6">
        <AdminSidebar />
        <main className="md:col-span-3">
          <div className="mb-4">
            <h1 className="text-2xl font-bold">Invoice settings</h1>
            <p className="text-sm text-gray-600">Manage the branding details used in generated invoices.</p>
          </div>

          <section className="bg-white p-4 rounded shadow">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold">Business details</h2>
                <p className="text-sm text-gray-600">Settings are locked until you explicitly choose Edit.</p>
              </div>
              {!editingSettings ? (
                <button type="button" onClick={() => setEditingSettings(true)} className="px-3 py-1 border rounded">Edit settings</button>
              ) : (
                <div className="flex gap-2">
                  <button type="button" onClick={() => { setSettingsDraft(invoiceSettings); setEditingSettings(false); }} className="px-3 py-1 border rounded">Cancel</button>
                  <button type="button" onClick={saveSettings} disabled={settingsBusy} className="px-3 py-1 bg-blue-600 text-white rounded">{settingsBusy ? 'Saving...' : 'Save settings'}</button>
                </div>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-3 mt-3">
              {['brandName','address','phone','email','watermarkText'].map((field) => (
                <div key={field} className={field === 'address' || field === 'watermarkText' ? 'md:col-span-2' : ''}>
                  <label className="block text-sm capitalize">{field.replace(/([A-Z])/g, ' $1')}</label>
                  {field === 'address' || field === 'watermarkText' ? (
                    <textarea
                      disabled={!editingSettings}
                      value={settingsDraft?.[field] || ''}
                      onChange={(e) => setSettingsDraft((prev) => ({ ...prev, [field]: e.target.value }))}
                      className="w-full p-2 border rounded"
                      rows={2}
                    />
                  ) : (
                    <input
                      disabled={!editingSettings}
                      value={settingsDraft?.[field] || ''}
                      onChange={(e) => setSettingsDraft((prev) => ({ ...prev, [field]: e.target.value }))}
                      className="w-full p-2 border rounded"
                    />
                  )}
                </div>
              ))}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

export async function getServerSideProps(ctx) {
  const session = await getSession(ctx);
  if (!session || session.user?.role !== 'admin') return authRedirect(ctx);
  return { props: {} };
}
