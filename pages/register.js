import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import { useToast } from '../components/Toast';

const normalizePhone = (value) => String(value || '').replace(/[^0-9+]/g, '');
const isValidWhatsApp = (value) => {
  const normalized = normalizePhone(value).replace(/^\+/, '');
  return /^[0-9]{8,15}$/.test(normalized);
};

export default function Register() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    whatsapp: '',
    address: '',
    locationUrl: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [whatsappError, setWhatsappError] = useState('');
  const toast = useToast();
  const [countdown, setCountdown] = useState(0);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setWhatsappError('');
    setLoading(true);
    const normalizedWhatsApp = normalizePhone(form.whatsapp);
    if (normalizedWhatsApp && !isValidWhatsApp(normalizedWhatsApp)) {
      setWhatsappError('Enter a valid WhatsApp number with 8–15 digits, optional +.');
      setLoading(false);
      return;
    }

    const body = {
      ...form,
      phone: normalizePhone(form.phone),
      whatsapp: normalizedWhatsApp,
    };

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');
      // success: show toast and countdown then redirect
      toast.push({ message: 'Registration successful! Redirecting to login in 10s...', type: 'success', duration: 10000 });
      setLoading(false);
      setCountdown(10);
      const t = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            clearInterval(t);
            router.push('/login');
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    } catch (err) {
      setError(err.message || 'Registration failed');
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: 'var(--baby-pink)' }}>
      <div className="bg-white p-6 rounded shadow w-full max-w-md card">
        <h1 className="text-2xl font-bold mb-4">Create an account</h1>
  {error && <div className="mb-3 text-red-600">{error}</div>}
  {countdown > 0 && <div className="mb-3 text-mehroon">Redirecting in {countdown} seconds — <button onClick={()=>router.push('/login')} className="underline">Jump to login now</button></div>}
        <form onSubmit={handleSubmit}>
          <input name="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" className="w-full p-2 border mb-3 rounded" />
          <input name="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" required className="w-full p-2 border mb-3 rounded" />
          <input name="password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Password" required className="w-full p-2 border mb-3 rounded" />
          <input name="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: normalizePhone(e.target.value) })} placeholder="Phone" className="w-full p-2 border mb-3 rounded" />
          <input
            name="whatsapp"
            value={form.whatsapp}
            onChange={(e) => {
              const next = normalizePhone(e.target.value);
              setForm({ ...form, whatsapp: next });
              if (whatsappError && isValidWhatsApp(next)) setWhatsappError('');
            }}
            placeholder="WhatsApp"
            className={`w-full p-2 mb-3 rounded border ${whatsappError ? 'border-red-500' : ''}`}
          />
          {whatsappError && <div className="text-red-600 text-sm mb-3">{whatsappError}</div>}
          <input name="address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Address" className="w-full p-2 border mb-3 rounded" />
          <input name="locationUrl" value={form.locationUrl} onChange={(e) => setForm({ ...form, locationUrl: e.target.value })} placeholder="Location URL" className="w-full p-2 border mb-3 rounded" />
          <button disabled={loading} className="w-full py-2 btn-primary rounded">
            {loading ? 'Creating...' : 'Create account'}
          </button>
        </form>

        <div className="text-sm text-center mt-4">
          Already have an account? <a href="/login" className="text-mehroon hover:underline">Sign in</a>
        </div>
      </div>
    </div>
  );
}
