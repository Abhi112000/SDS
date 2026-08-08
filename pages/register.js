import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import { useToast } from '../components/Toast';

export default function Register() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();
  const [countdown, setCountdown] = useState(0);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const body = Object.fromEntries(form.entries());
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
          <input name="name" placeholder="Full name" className="w-full p-2 border mb-3 rounded" />
          <input name="email" type="email" placeholder="Email" required className="w-full p-2 border mb-3 rounded" />
          <input name="password" type="password" placeholder="Password" required className="w-full p-2 border mb-3 rounded" />
          <input name="phone" placeholder="Phone" className="w-full p-2 border mb-3 rounded" />
          <input name="whatsapp" placeholder="WhatsApp" className="w-full p-2 border mb-3 rounded" />
          <input name="address" placeholder="Address" className="w-full p-2 border mb-3 rounded" />
          <input name="locationUrl" placeholder="Location URL" className="w-full p-2 border mb-3 rounded" />
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
