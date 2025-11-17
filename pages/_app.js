import '../styles/globals.css';
import Script from 'next/script';
import Head from 'next/head';
import { SessionProvider } from 'next-auth/react';
import { CartProvider } from '../components/CartContext';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { ToastProvider } from '../components/Toast';
import HelpButton from '../components/HelpButton';

export default function App({ Component, pageProps: { session, ...pageProps } }) {
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
          <Script src="https://cdn.jsdelivr.net/npm/chart.js" strategy="beforeInteractive" />
          <Header />
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
