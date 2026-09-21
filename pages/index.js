import Hero from '@/components/Hero';
import Services from '@/components/Services';
import TrustBar from '@/components/TrustBar';
import DeliveryInfo from '@/components/DeliveryInfo';
import DeliveryAvailability from '@/components/DeliveryAvailability';
import BulkOrders from '@/components/BulkOrders';
import WhyChooseUs from '@/components/WhyChooseUs';
import HowItWorks from '@/components/HowItWorks';
import FeaturedCategories from '@/components/FeaturedCategories';
import FeaturedProducts from '@/components/FeaturedProducts';
import Testimonials from '@/components/Testimonials';
import ContactSection from '@/components/ContactSection';
import Footer from '@/components/Footer';
import Link from "next/link";
import ProductCard from "../components/ProductCard";
import dbConnect from '@/lib/mongodb';
import Product from '@/models/Product';
import { useEffect, useState } from 'react';

const quickReachItems = [
  { title: 'Looking for gifts', category: 'Gifts', accent: 'from-pink-100 to-rose-100', icon: '🎁' },
  { title: 'Looking for notebooks', category: 'Notebooks', accent: 'from-amber-100 to-yellow-100', icon: '📓' },
  { title: 'Looking for pens', category: 'Pens', accent: 'from-cyan-100 to-sky-100', icon: '🖊️' },
  { title: 'Office basics', category: 'Office Supplies', accent: 'from-violet-100 to-indigo-100', icon: '📚' }
];

export default function Home({ products = [], saleProducts = [], newArrivals = [] }) {
  const [slides, setSlides] = useState([]);
  const [activeSlide, setActiveSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    fetch('/api/admin/home-banner', { credentials: 'include' })
      .then((res) => res.ok ? res.json() : { slides: [] })
      .then((data) => {
        const items = Array.isArray(data?.slides) && data.slides.length ? data.slides : [];
        setSlides(items);
      })
      .catch(() => setSlides([]));
  }, []);

  const goToSlide = (direction) => {
    if (!slides.length) return;
    setActiveSlide((prev) => {
      if (slides.length === 1) return 0;
      const next = direction === 'next' ? (prev + 1) % slides.length : (prev - 1 + slides.length) % slides.length;
      return next;
    });
  };

  useEffect(() => {
    if (!slides.length || slides.length < 2 || isPaused) return;
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % slides.length);
    }, 4200);
    return () => clearInterval(timer);
  }, [slides, isPaused]);

  const showCarousel = slides.length > 1;
  const activeImage = slides[activeSlide] || slides[0];

  return (
    <main className="pb-4 md:pb-6">
      <section className="py-3 md:py-6">
        <div className="max-w-7xl mx-auto px-3 md:px-4">
          <div className="hero-shell">
            <div className="grid lg:grid-cols-[1.08fr_.92fr] items-center gap-6 md:gap-8">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-[11px] md:text-xs font-bold uppercase tracking-[0.18em] text-primary shadow-sm">
                  <span className="h-2 w-2 rounded-full bg-red-500" />
                  Shree Durga Store
                </div>
                <h1 className="page-section-title mt-3 md:mt-4 text-gray-900">Stationery essentials for study, work and daily use.</h1>
                <p className="text-sm md:text-base leading-6 md:leading-7 text-slate-600 mt-3 md:mt-4 max-w-xl">Browse practical stationery items for school, office, and creative needs — from notebooks and pens to files, art supplies, and daily desk essentials.</p>

                <div className="flex flex-wrap gap-2.5 mt-4 md:mt-5">
                  <Link href="/shop" className="inline-flex items-center justify-center btn-primary px-4 py-2.5 rounded-full font-semibold text-sm md:text-base">Shop Collection</Link>
                  <Link href="/contact" className="inline-flex items-center justify-center btn-ghost px-4 py-2.5 rounded-full font-semibold text-sm md:text-base">Visit Store</Link>
                </div>

                <div className="mt-5 md:mt-6 flex flex-wrap gap-2.5">
                  {['Paper & Office', 'School Supplies', 'Art & Creative'].map((item) => (
                    <span key={item} className="feature-pill">{item}</span>
                  ))}
                </div>
              </div>

              <div className="relative hidden lg:block">
                <div className="absolute -inset-3 rounded-[2rem] bg-gradient-to-tr from-red-100 via-sky-100 to-violet-100 blur-2xl opacity-80" aria-hidden="true" />
                <div className="relative overflow-hidden rounded-[2rem] border border-white/80 bg-white/85 p-3 md:p-4 shadow-[0_25px_60px_rgba(15,23,42,0.12)] backdrop-blur-sm">
                  {showCarousel ? (
                    <div className="relative" onMouseEnter={() => setIsPaused(true)} onMouseLeave={() => setIsPaused(false)}>
                      <div className="relative overflow-hidden rounded-[1.5rem] bg-gradient-to-br from-slate-50 via-white to-sky-50 h-[230px] sm:h-[280px] md:h-[360px]">
                        {slides.map((slide, index) => {
                          const imageUrl = slide?.imageUrl || '/images/sample1.svg';
                          const commonClass = `absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ease-in-out ${index === activeSlide ? 'opacity-100 z-10' : 'opacity-0 z-0'}`;

                          return (
                            <div key={`${slide.imageUrl || 'slide'}-${index}`} className={index === activeSlide ? 'block h-full' : 'hidden'}>
                              {slide?.link ? (
                                <Link href={slide.link} className="block h-full">
                                  <img src={imageUrl} alt={slide?.altText || 'Featured stationery item'} className={commonClass} />
                                </Link>
                              ) : (
                                <img src={imageUrl} alt={slide?.altText || 'Featured stationery item'} className={commonClass} />
                              )}
                            </div>
                          );
                        })}

                        {activeImage?.caption && (
                          <div className="absolute inset-x-5 bottom-5 z-20 rounded-full bg-white/85 px-3 py-2 text-center text-[11px] md:text-sm font-semibold text-slate-700 shadow-sm backdrop-blur-sm">
                            {activeImage.caption}
                          </div>
                        )}

                        <button type="button" onClick={() => goToSlide('prev')} aria-label="Previous slide" className="carousel-button left-3">
                          ‹
                        </button>
                        <button type="button" onClick={() => goToSlide('next')} aria-label="Next slide" className="carousel-button right-3">
                          ›
                        </button>
                      </div>

                      <div className="mt-3 flex items-center justify-center gap-2">
                        {slides.map((slide, index) => (
                          <button
                            key={`${slide.imageUrl || 'dot'}-${index}`}
                            type="button"
                            aria-label={`Go to slide ${index + 1}`}
                            onClick={() => setActiveSlide(index)}
                            className={`h-2.5 rounded-full transition-all ${index === activeSlide ? 'w-8 bg-red-600' : 'w-2.5 bg-slate-300 hover:bg-slate-400'}`}
                          />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-[1.5rem] bg-gradient-to-br from-slate-50 via-white to-sky-50 p-3 md:p-4">
                      {slides[0]?.link ? (
                        <Link href={slides[0].link}>
                          <img src={slides[0]?.imageUrl || '/images/sample1.svg'} alt={slides[0]?.altText || 'Stationery essentials'} className="w-full h-[230px] sm:h-[260px] md:h-[320px] object-cover rounded-xl drop-shadow-[0_25px_40px_rgba(15,23,42,0.08)]" />
                        </Link>
                      ) : (
                        <img src={slides[0]?.imageUrl || '/images/sample1.svg'} alt={slides[0]?.altText || 'Stationery essentials'} className="w-full h-[230px] sm:h-[260px] md:h-[320px] object-cover rounded-xl drop-shadow-[0_25px_40px_rgba(15,23,42,0.08)]" />
                      )}
                      {slides[0]?.caption && (
                        <div className="mt-3 rounded-full bg-slate-100 px-2.5 py-1.5 text-center text-xs font-medium text-slate-700">{slides[0].caption}</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-3 md:px-4 py-4 md:py-6">
        <div className="mb-4 md:mb-5 text-center md:text-left">
          <div className="page-section-kicker">Quick Reach</div>
          <h2 className="text-lg md:text-2xl font-bold mt-2 text-gray-800">Popular categories</h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 md:gap-3">
          {quickReachItems.map((item) => (
            <Link key={item.category} href={{ pathname: '/shop', query: { category: item.category } }} className={`group block rounded-[1.25rem] border border-slate-200 bg-gradient-to-br ${item.accent} p-2.5 sm:p-3 md:p-3.5 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg`}>
              <div className="flex items-center justify-between gap-2">
                <div className="text-xl sm:text-2xl md:text-3xl">{item.icon}</div>
                <span className="rounded-full bg-white/70 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Shop</span>
              </div>
              <div className="text-[11px] sm:text-xs md:text-sm lg:text-base font-bold text-slate-800 mt-2 sm:mt-3">{item.title}</div>
              <div className="mt-1.5 sm:mt-2 inline-flex items-center gap-1 sm:gap-2 text-[9px] sm:text-[10px] md:text-[11px] font-semibold text-primary group-hover:underline">Explore now →</div>
            </Link>
          ))}
        </div>
      </section>

      {newArrivals && newArrivals.length > 0 && (
        <section className="max-w-7xl mx-auto px-3 md:px-4 py-4 md:py-6">
          <div className="flex items-end justify-between gap-4 mb-3 md:mb-4">
            <div>
              <div className="page-section-kicker">Fresh picks</div>
              <h2 className="text-lg md:text-2xl font-bold mt-2 text-gray-800">New Arrivals</h2>
            </div>
            <Link href="/shop" className="hidden sm:inline-flex items-center gap-2 text-xs md:text-sm font-bold text-primary hover:underline">View all</Link>
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5">
            {newArrivals.map((p, i) => (
              <ProductCard key={p._id || p.sku || i} product={p} />
            ))}
          </div>
        </section>
      )}

      {products && products.length > 0 && (
        <section className="max-w-7xl mx-auto px-3 md:px-4 py-4 md:py-6">
          <div className="flex items-end justify-between gap-4 mb-3 md:mb-4">
            <div>
              <div className="page-section-kicker">Collections</div>
              <h2 className="text-lg md:text-2xl font-bold mt-2 text-gray-800">Featured Products</h2>
            </div>
            <Link href="/shop" className="hidden sm:inline-flex items-center gap-2 text-xs md:text-sm font-bold text-primary hover:underline">Browse all</Link>
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5">
            {products.map((p, i) => (
              <ProductCard key={p.sku || i} product={p} />
            ))}
          </div>
        </section>
      )}

      {saleProducts && saleProducts.length > 0 && (
        <section className="max-w-7xl mx-auto px-3 md:px-4 py-4 md:py-6">
          <div className="flex items-end justify-between gap-4 mb-3 md:mb-4">
            <div>
              <div className="page-section-kicker">Offers</div>
              <h2 className="text-lg md:text-2xl font-bold mt-2 text-red-600">On Sale</h2>
            </div>
            <Link href="/shop" className="hidden sm:inline-flex items-center gap-2 text-xs md:text-sm font-bold text-primary hover:underline">See deals</Link>
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5">
            {saleProducts.map((p, i) => (
              <ProductCard key={p._id || i} product={p} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

export async function getServerSideProps(){
  try{
    await dbConnect();
    const products = await Product.find({ featured: true }).lean();
    const saleProducts = await Product.find({ $or: [{ onSale: true }, { tags: 'SALE!' }] }).lean();
    const newArrivals = await Product.find({ isNewArrival: true }).sort({ createdAt: -1 }).limit(8).lean();
    return { props: { products: JSON.parse(JSON.stringify(products || [])), saleProducts: JSON.parse(JSON.stringify(saleProducts || [])), newArrivals: JSON.parse(JSON.stringify(newArrivals || [])) } };
  }catch(e){
    console.warn('Could not load home products', e && e.message);
    return { props: { products: [], saleProducts: [], newArrivals: [] } };
  }
}
