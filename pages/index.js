import Link from "next/link";
import ProductCard from "../components/ProductCard";
import dbConnect from '@/lib/mongodb';
import Product from '@/models/Product';

export default function Home({ products = [], saleProducts = [] }) {
  return (
    <main>
      <section className="py-16 md:py-20 hero-gradient">
        <div className="max-w-7xl mx-auto px-4 grid md:grid-cols-[1.04fr_.96fr] gap-10 items-center hero-inner">
          <div className="max-w-2xl">
            <div className="page-section-kicker">Shree Durga Store</div>
            <h1 className="page-section-title mt-4 text-gray-800">Quality Stationery, Delivered</h1>
            <p className="text-lg md:text-xl leading-8 text-gray-700 mt-6 max-w-xl">Everything your school, office or creative studio needs — curated with care, packed fast, and ready to use.</p>
            <div className="flex flex-wrap gap-4 mt-7">
              <Link href="/shop" className="inline-flex items-center justify-center btn-primary px-6 py-3 rounded-full font-semibold">Shop Now</Link>
              <Link href="/contact" className="inline-flex items-center justify-center btn-ghost px-6 py-3 rounded-full font-semibold">Visit Store</Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <span className="text-sm px-4 py-2 rounded-full bg-white border border-gray-200 text-slate-700">Paper & Office</span>
              <span className="text-sm px-4 py-2 rounded-full bg-white border border-gray-200 text-slate-700">School Supplies</span>
              <span className="text-sm px-4 py-2 rounded-full bg-white border border-gray-200 text-slate-700">Art & Creative</span>
            </div>
          </div>
          <div className="block relative">
            <div className="absolute -inset-4 rounded-[2rem] blur-2xl bg-gradient-to-tr from-red-100 to-sky-100 opacity-75" aria-hidden="true" />
            <div className="relative bg-white/90 border border-white/80 rounded-[2rem] p-4 shadow-2xl">
              <img src="/images/sample1.svg" alt="stationery" className="w-full h-auto max-h-[340px] object-contain" />
            </div>
          </div>
        </div>
      </section>

      {products && products.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 py-16">
          <div className="flex items-end justify-between gap-4 mb-6">
            <div>
              <div className="page-section-kicker">Collections</div>
              <h2 className="text-2xl md:text-3xl font-bold mt-3 text-gray-800">Featured Products</h2>
            </div>
            <Link href="/shop" className="hidden sm:inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline">Browse all</Link>
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map((p, i) => (
              <ProductCard key={p.sku || i} product={p} />
            ))}
          </div>
        </section>
      )}

      {saleProducts && saleProducts.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 py-16">
          <div className="flex items-end justify-between gap-4 mb-6">
            <div>
              <div className="page-section-kicker">Offers</div>
              <h2 className="text-2xl md:text-3xl font-bold mt-3 text-red-600">On Sale</h2>
            </div>
            <Link href="/shop" className="hidden sm:inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline">See deals</Link>
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
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
  return { props: { products: JSON.parse(JSON.stringify(products || [])), saleProducts: JSON.parse(JSON.stringify(saleProducts || [])) } };
  }catch(e){
    console.warn('Could not load featured products', e && e.message);
    return { props: { products: [] } };
  }
}
