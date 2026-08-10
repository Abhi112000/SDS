import '../styles/globals.css';
import Head from 'next/head';
import { SessionProvider } from 'next-auth/react';
import { CartProvider } from '../components/CartContext';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { ToastProvider } from '../components/Toast';
import HelpButton from '../components/HelpButton';
import { useEffect, useRef, useState } from 'react';
import Router from 'next/router';

export default function App({ Component, pageProps: { session, ...pageProps } }) {
  const [loadingRoute, setLoadingRoute] = useState(false);
  const routeTimer = useRef(null);

  useEffect(()=>{
    const handleStart = () => {
      if (routeTimer.current) clearTimeout(routeTimer.current);
      routeTimer.current = setTimeout(() => setLoadingRoute(true), 180);
    };
    const handleStop = () => {
      if (routeTimer.current) clearTimeout(routeTimer.current);
      routeTimer.current = null;
      setLoadingRoute(false);
    };
    Router.events.on('routeChangeStart', handleStart);
    Router.events.on('routeChangeComplete', handleStop);
    Router.events.on('routeChangeError', handleStop);
    return () => {
      if (routeTimer.current) clearTimeout(routeTimer.current);
      Router.events.off('routeChangeStart', handleStart);
      Router.events.off('routeChangeComplete', handleStop);
      Router.events.off('routeChangeError', handleStop);
    };
  },[]);

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
          {loadingRoute && (
            <div aria-live="polite" className="pointer-events-none fixed left-0 right-0 top-0 z-[100] h-1 overflow-hidden bg-red-100">
              <div className="h-full w-1/3 animate-[route-progress_1s_ease-in-out_infinite] bg-red-600" />
            </div>
          )}
          <main className="min-h-[70vh] container mx-auto px-4 py-6">
            <Component {...pageProps} />
          </main>
          <Footer />
          <HelpButton />
        </ToastProvider>
      </CartProvider>
    </SessionProvider>
  );
}
