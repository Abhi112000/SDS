import { getSession, signIn } from "next-auth/react";
import { useToast } from '../components/Toast';
import { useRouter } from 'next/router';
import { useState } from 'react';

export default function Login() {
  const toast = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const callbackUrl = typeof router.query.callbackUrl === 'string' ? router.query.callbackUrl : '/dashboard';

  return (
    <div className="flex flex-col items-center justify-center min-h-[55vh] py-5">
      <h1 className="text-xl font-bold mb-3">Login</h1>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm w-full max-w-sm">
        {loading && (
          <div className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-800" role="status" aria-live="polite">
            Signing in, please wait...
          </div>
        )}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (loading) return;
            setLoading(true);
            const email = e.target.email.value;
            const password = e.target.password.value;
            try {
              const result = await signIn("credentials", { email, password, redirect: false, callbackUrl });
              if (result?.error) {
                toast.push({ message: 'Login failed: ' + result.error, type: 'error' });
                setLoading(false);
              } else if (result?.status && result.status >= 500) {
                toast.push({ message: `Server error during login (status ${result.status}). Check server logs.`, type: 'error' });
                setLoading(false);
              } else {
                toast.push({ message: 'Login successful! Redirecting...', type: 'success' });
                const destination = result?.url || callbackUrl;
                if (!result?.url && callbackUrl === '/dashboard') {
                  await router.replace('/dashboard');
                } else {
                  await router.replace(destination);
                }
              }
            } catch (error) {
              toast.push({ message: 'Login failed. Please try again.', type: 'error' });
              setLoading(false);
            }
          }}
        >
          <label htmlFor="login-email" className="mb-1 block text-xs font-semibold text-slate-700">Email</label>
          <input
            id="login-email"
            type="email"
            name="email"
            placeholder="Email"
            autoComplete="email"
            required
            className="w-full p-2 border mb-3 rounded-lg text-sm"
          />
          <label htmlFor="login-password" className="mb-1 block text-xs font-semibold text-slate-700">Password</label>
          <input
            id="login-password"
            type="password"
            name="password"
            placeholder="Password"
            autoComplete="current-password"
            required
            className="w-full p-2 border mb-3 rounded-lg text-sm"
          />
          <button
            type="submit"
            disabled={loading}
            aria-busy={loading}
            className="w-full py-2 btn-primary rounded disabled:cursor-wait disabled:opacity-60"
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <div className="text-right mt-2">
          <a href="/auth/forgot" className="text-xs text-mehroon hover:underline">Forgot password?</a>
        </div>

        <div className="mt-3 text-center text-xs">
          Don't have an account? <a href="/register" className="text-mehroon hover:underline">Sign up</a>
        </div>
      </div>
    </div>
  );
}

export async function getServerSideProps(context) {
  const session = await getSession(context);
  if (session) {
    return {
      redirect: {
        destination: session.user?.role === 'admin' ? '/admin' : (context.query.callbackUrl || '/dashboard'),
        permanent: false,
      },
    };
  }
  return { props: {} };
}
