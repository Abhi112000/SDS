import { getSession, signIn, useSession } from "next-auth/react";
import { useToast } from '../components/Toast';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

export default function Login() {
  const toast = useToast();
  const router = useRouter();
  const { data: session, status } = useSession();
  const callbackUrl = router.query.callbackUrl || '/profile';

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace(callbackUrl);
    }
  }, [status, callbackUrl, router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-2xl font-bold mb-6">Login</h1>

      <div className="bg-white p-6 rounded shadow w-80">
        {/* Email/Password Login */}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const email = e.target.email.value;
            const password = e.target.password.value;
            const result = await signIn("credentials", { email, password, redirect: false, callbackUrl });
            // diagnostic logging (helps on Vercel) and better messaging for server errors
            try { console.log('signIn result', result); } catch (e) {}
            if (result?.error) {
              toast.push({ message: 'Login failed: ' + result.error, type: 'error' });
            } else if (result?.status && result.status >= 500) {
              toast.push({ message: `Server error during login (status ${result.status}). Check server logs.`, type: 'error' });
            } else {
              toast.push({ message: 'Login successful! Redirecting...', type: 'success' });
              router.replace(result?.url || callbackUrl);
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
            className="w-full py-2 btn-primary rounded"
          >
            Sign In
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
        destination: context.query.callbackUrl || '/profile',
        permanent: false,
      },
    };
  }
  return { props: {} };
}
