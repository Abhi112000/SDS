import { getSession, useSession } from "next-auth/react";
import { useState } from "react";

export default function Profile({ user }) {
  const { data: session } = useSession();
  const [form, setForm] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
    address: user?.address || "",
    locationUrl: user?.locationUrl || "",
  });

  const [loading, setLoading] = useState(false);

  const save = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) throw new Error("Failed to update profile");
      alert("Profile updated successfully!");
    } catch (err) {
      console.error(err);
      alert("Something went wrong while saving your profile.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Profile</h1>

      <div className="bg-white p-4 rounded shadow max-w-lg">
        <label className="block mb-2 font-medium">Full Name</label>
        <input
          className="w-full p-2 border mb-4 rounded"
          value={form.name}
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
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          placeholder="Your phone number"
        />

        <label className="block mb-2 font-medium">Home Address</label>
        <input
          className="w-full p-2 border mb-4 rounded"
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
          placeholder="Your address"
        />

        <label className="block mb-2 font-medium">Location URL</label>
        <input
          className="w-full p-2 border mb-4 rounded"
          value={form.locationUrl}
          onChange={(e) => setForm({ ...form, locationUrl: e.target.value })}
          placeholder="Paste your Google Map URL"
        />

        <button
          onClick={save}
          disabled={loading}
          className={`px-4 py-2 rounded text-white ${loading ? "bg-gray-400" : "btn-primary"}`}
        >
          {loading ? "Saving..." : "Save"}
        </button>
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
