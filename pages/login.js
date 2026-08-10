import { getSession, signIn } from "next-auth/react";
import { useToast } from '../components/Toast';
import { useRouter } from 'next/router';
import { useState } from 'react';

export default function Login() {
  const toast = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const callbackUrl = typeof router.query.callbackUrl === 'string' ? router.query.callbackUrl : '/profile';

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-2xl font-bold mb-6">Login</h1>

      <div className="bg-white p-6 rounded shadow w-80">
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
                if (!result?.url && callbackUrl === '/profile') {
                  let hasCartItems = false;
                  try {
                    const savedCart = JSON.parse(localStorage.getItem('sd_cart') || '{}');
                    hasCartItems = Array.isArray(savedCart.items) && savedCart.items.length > 0;
                  } catch (error) {
                    hasCartItems = false;
                  }
                  await router.replace(hasCartItems ? '/cart' : '/shop');
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
          <input
            type="email"
            name="email"
            placeholder="Email"
            className="w-full p-2 border mb-3 rounded"
          />
          <input
            type="password"
            name="password"
            placeholder="Password"
            className="w-full p-2 border mb-3 rounded"
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
          <a href="/auth/forgot" className="text-sm text-mehroon hover:underline">Forgot password?</a>
        </div>

        <div className="mt-4 text-center text-sm">
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
        destination: session.user?.role === 'admin' ? '/admin' : (context.query.callbackUrl || '/profile'),
        permanent: false,
      },
    };
  }
  return { props: {} };
}
