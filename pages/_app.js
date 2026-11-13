import '../styles/globals.css';
import Head from 'next/head';
import { SessionProvider } from 'next-auth/react';
import { CartProvider } from '../components/CartContext';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { ToastProvider } from '../components/Toast';
import { useRouter } from 'next/router';

export default function App({ Component, pageProps: { session, ...pageProps } }) {
  const router = useRouter();
  const compactPage = ['/', '/shop'].includes(router.pathname);
  const accountPage = ['/cart', '/login'].includes(router.pathname);

  const nextAuthBaseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://sdstationery.vercel.app';

  return (
    <SessionProvider session={session} baseUrl={nextAuthBaseUrl} basePath="/api/auth">
      <CartProvider>
        <ToastProvider>
          <Head>
            {/* use the provided logo.jpeg as favicon (browser will resize; it's a jpeg so sizes may vary) */}
            <link rel="icon" href="/images/logo.jpeg" />
            <meta name="viewport" content="width=device-width,initial-scale=1" />
            <meta name="description" content="Shree Durga Stationary — quality stationery delivered. Pens, pencils, notebooks, and more for school, office and creatives." />
            <meta name="theme-color" content="#B71C1C" />
          </Head>
          <Header />
          <main className={compactPage ? 'min-h-0 w-full' : accountPage ? 'min-h-[50vh] w-full px-3 py-3 md:px-4 md:py-4' : 'min-h-[70vh] container mx-auto px-3 py-4 md:px-4 md:py-5'}>
            <Component {...pageProps} />
          </main>
          <Footer />
        </ToastProvider>
      </CartProvider>
    </SessionProvider>
  );
}
