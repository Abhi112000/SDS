import { getSession, useSession } from "next-auth/react";
import { useState } from "react";
import { useToast } from '@/components/Toast';

export default function Profile({ user }) {
  const { data: session } = useSession();
  const [form, setForm] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
    whatsapp: user?.whatsapp || "",
    address: user?.address || "",
    locationUrl: user?.locationUrl || "",
  });

  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const toast = useToast();

  const save = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify(form),
      });

      if (!res.ok) throw new Error("Failed to update profile");
      toast?.push?.({ message: 'Profile updated successfully!', type: 'success' });
      setEditing(false);
    } catch (err) {
      console.error(err);
      toast?.push?.({ message: 'Something went wrong while saving your profile.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Profile</h1>
        {!editing && (
          <button onClick={() => setEditing(true)} className="px-4 py-2 btn-primary rounded">Edit</button>
        )}
      </div>

      <div className="bg-white p-4 rounded shadow max-w-lg">
        <label className="block mb-2 font-medium">Full Name</label>
        <input
          className="w-full p-2 border mb-4 rounded"
          value={form.name}
          disabled={!editing}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Your name"
        />

        <label className="block mb-2 font-medium">Email</label>
        <input
          className="w-full p-2 border mb-4 rounded bg-gray-100 cursor-not-allowed"
          value={form.email}
          readOnly
        />

        <label className="block mb-2 font-medium">Phone</label>
        <input
          className="w-full p-2 border mb-4 rounded"
          value={form.phone}
          disabled={!editing}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          placeholder="Your phone number"
        />

        <label className="block mb-2 font-medium">WhatsApp Number</label>
        <input
          className="w-full p-2 border mb-4 rounded"
          value={form.whatsapp}
          disabled={!editing}
          onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
          placeholder="Your WhatsApp number"
        />

        <label className="block mb-2 font-medium">Home Address</label>
        <input
          className="w-full p-2 border mb-4 rounded"
          value={form.address}
          disabled={!editing}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
          placeholder="Your address"
        />

        <label className="block mb-2 font-medium">Location URL</label>
        <input
          className="w-full p-2 border mb-4 rounded"
          value={form.locationUrl}
          disabled={!editing}
          onChange={(e) => setForm({ ...form, locationUrl: e.target.value })}
          placeholder="Paste your Google Map URL"
        />

        {editing && (
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={loading}
              className={`px-4 py-2 rounded text-white ${loading ? "bg-gray-400" : "btn-primary"}`}
            >
              {loading ? "Saving..." : "Save"}
            </button>
            <button onClick={() => { setEditing(false); setForm({ name: user?.name || '', email: user?.email || '', phone: user?.phone || '', whatsapp: user?.whatsapp || '', address: user?.address || '', locationUrl: user?.locationUrl || '' }); }} className="px-4 py-2 border rounded">Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}

export async function getServerSideProps(ctx) {
  const session = await getSession(ctx);
  if (!session)
    return { redirect: { destination: "/api/auth/signin", permanent: false } };

  return { props: { user: session.user } };
}
