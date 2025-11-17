import { getProviders, signIn } from "next-auth/react";
import { useToast } from '../components/Toast';
import { useRouter } from 'next/router';

export default function Login({ providers }) {
  const toast = useToast();
  const router = useRouter();
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
            const result = await signIn("credentials", { email, password, redirect: false });
            if (result?.error) {
              toast.push({ message: 'Login failed: ' + result.error, type: 'error' });
            } else {
              toast.push({ message: 'Login successful! Redirecting...', type: 'success' });
              router.push('/profile');
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

        {/* Divider */}
        <div className="text-center my-4 text-gray-500">OR</div>

        {/* Google Login */}
        <div className="mt-4 text-center text-sm">
          Don't have an account? <a href="/register" className="text-mehroon hover:underline">Sign up</a>
        </div>
        {providers &&
          Object.values(providers).map(
            (provider) =>
              provider.id === "google" && (
                <button
                  key={provider.name}
                  onClick={() => signIn(provider.id, { callbackUrl: "/" })}
                  className="w-full py-2 btn-primary rounded"
                >
                  Sign in with {provider.name}
                </button>
              )
          )}
      </div>
    </div>
  );
}

export async function getServerSideProps() {
  const providers = await getProviders();
  return { props: { providers } };
}
