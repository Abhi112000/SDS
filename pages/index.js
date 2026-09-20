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

const quickReachItems = [
  { title: 'Looking for gifts', category: 'Gifts', accent: 'from-pink-100 to-rose-100', icon: '🎁' },
  { title: 'Looking for notebooks', category: 'Notebooks', accent: 'from-amber-100 to-yellow-100', icon: '📓' },
  { title: 'Looking for pens', category: 'Pens', accent: 'from-cyan-100 to-sky-100', icon: '🖊️' },
  { title: 'Office basics', category: 'Office Supplies', accent: 'from-violet-100 to-indigo-100', icon: '📚' }
];

export default function Home({ products = [], saleProducts = [], newArrivals = [] }) {
  return (
    <main>
      <section className="py-4 md:py-8 hero-gradient">
        <div className="max-w-7xl mx-auto px-3 md:px-4 grid md:grid-cols-[1.04fr_.96fr] gap-5 md:gap-8 items-center hero-inner">
          <div className="max-w-2xl">
            <div className="page-section-kicker">Shree Durga Store</div>
            <h1 className="page-section-title mt-2 md:mt-3 text-gray-800">Quality Stationery, Delivered</h1>
            <p className="text-base md:text-lg leading-7 md:leading-8 text-gray-700 mt-3 md:mt-4 max-w-xl">Everything your school, office or creative studio needs — curated with care, packed fast, and ready to use.</p>
            <div className="flex flex-wrap gap-3 mt-4 md:mt-5">
              <Link href="/shop" className="inline-flex items-center justify-center btn-primary px-4 py-2.5 md:px-5 md:py-3 rounded-full font-semibold text-sm md:text-base">Shop Now</Link>
              <Link href="/contact" className="inline-flex items-center justify-center btn-ghost px-4 py-2.5 md:px-5 md:py-3 rounded-full font-semibold text-sm md:text-base">Visit Store</Link>
            </div>
            <div className="mt-4 md:mt-6 flex flex-wrap gap-2 md:gap-3">
              <span className="text-xs md:text-sm px-3 py-1.5 md:px-4 md:py-2 rounded-full bg-white border border-gray-200 text-slate-700">Paper & Office</span>
              <span className="text-xs md:text-sm px-3 py-1.5 md:px-4 md:py-2 rounded-full bg-white border border-gray-200 text-slate-700">School Supplies</span>
              <span className="text-xs md:text-sm px-3 py-1.5 md:px-4 md:py-2 rounded-full bg-white border border-gray-200 text-slate-700">Art & Creative</span>
            </div>
          </div>
          <div className="block relative">
            <div className="absolute -inset-3 rounded-[1.5rem] blur-2xl bg-gradient-to-tr from-red-100 to-sky-100 opacity-75" aria-hidden="true" />
            <div className="relative bg-white/90 border border-white/80 rounded-[1.5rem] p-3 md:p-4 shadow-xl">
              <img src="/images/sample1.svg" alt="stationery" className="w-full h-auto max-h-[260px] md:max-h-[320px] object-contain" />
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-3 md:px-4 py-6 md:py-10">
        <div className="mb-5 md:mb-6 text-center md:text-left">
          <div className="page-section-kicker">Quick Reach</div>
          <h2 className="text-xl md:text-3xl font-bold mt-2 text-gray-800">Quick Reach To Your Product</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {quickReachItems.map((item) => (
            <Link key={item.category} href={{ pathname: '/shop', query: { category: item.category } }} className={`group block rounded-2xl border border-slate-200 bg-gradient-to-br ${item.accent} p-4 md:p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg`}>
              <div className="text-3xl md:text-4xl mb-3 md:mb-4">{item.icon}</div>
              <div className="text-base md:text-lg font-bold text-slate-800">{item.title}</div>
              <div className="mt-2 md:mt-3 inline-flex items-center gap-2 text-xs md:text-sm font-semibold text-primary group-hover:underline">Explore now →</div>
            </Link>
          ))}
        </div>
      </section>

      {newArrivals && newArrivals.length > 0 && (
        <section className="max-w-7xl mx-auto px-3 md:px-4 py-6 md:py-10">
          <div className="flex items-end justify-between gap-4 mb-4 md:mb-5">
            <div>
              <div className="page-section-kicker">Fresh picks</div>
              <h2 className="text-xl md:text-3xl font-bold mt-2 text-gray-800">New Arrivals</h2>
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
        <section className="max-w-7xl mx-auto px-3 md:px-4 py-6 md:py-10">
          <div className="flex items-end justify-between gap-4 mb-4 md:mb-5">
            <div>
              <div className="page-section-kicker">Collections</div>
              <h2 className="text-xl md:text-3xl font-bold mt-2 text-gray-800">Featured Products</h2>
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
        <section className="max-w-7xl mx-auto px-3 md:px-4 py-6 md:py-10">
          <div className="flex items-end justify-between gap-4 mb-4 md:mb-5">
            <div>
              <div className="page-section-kicker">Offers</div>
              <h2 className="text-xl md:text-3xl font-bold mt-2 text-red-600">On Sale</h2>
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
