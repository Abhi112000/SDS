import '../styles/globals.css';
import Head from 'next/head';
import { SessionProvider } from 'next-auth/react';
import { CartProvider } from '../components/CartContext';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { ToastProvider } from '../components/Toast';
import HelpButton from '../components/HelpButton';
import { useEffect, useState } from 'react';
import Router from 'next/router';

export default function App({ Component, pageProps: { session, ...pageProps } }) {
  const [loadingRoute, setLoadingRoute] = useState(false);

  useEffect(()=>{
    const handleStart = () => setLoadingRoute(true);
    const handleStop = () => setLoadingRoute(false);
    Router.events.on('routeChangeStart', handleStart);
    Router.events.on('routeChangeComplete', handleStop);
    Router.events.on('routeChangeError', handleStop);
    return () => {
      Router.events.off('routeChangeStart', handleStart);
      Router.events.off('routeChangeComplete', handleStop);
      Router.events.off('routeChangeError', handleStop);
    };
  },[]);

  return (
    <SessionProvider session={session}>
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
            <div aria-live="polite" className="fixed inset-0 z-50 flex items-center justify-center">
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
              <div className="relative z-10 bg-white/95 dark:bg-gray-900/90 rounded-lg p-6 shadow-xl flex flex-col items-center gap-4 max-w-xs w-full">
          <div className="flex items-center justify-center w-16 h-16">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" className="w-12 h-12 transform animate-spin" style={{ animationDuration: '1.4s' }} aria-hidden="true">
                    <defs>
                      <linearGradient id="g1" x1="0" x2="1">
                        <stop offset="0%" stopColor="#f97316" />
                        <stop offset="100%" stopColor="#ef4444" />
                      </linearGradient>
                    </defs>
                    <g>
                      <path d="M45.7 6.3L57.7 18.3 23.7 52.3 11.7 40.3z" fill="url(#g1)" stroke="#c2410c" strokeWidth="1"/>
                      <rect x="7" y="47" width="40" height="10" rx="2" fill="#f3f4f6" stroke="#d1d5db" />
                      <path d="M51 12l1.5 1.5" stroke="#374151" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M48 15l6 6" stroke="#374151" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      <circle cx="50" cy="14" r="1.6" fill="#111827" />
                    </g>
                  </svg>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-gray-800 dark:text-gray-100">Preparing page</div>
                  <div className="text-sm text-gray-600 dark:text-gray-300">Loading — please wait</div>
                </div>
              </div>
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
