import Link from "next/link";
import ProductCard from "../components/ProductCard";
import dbConnect from '@/lib/mongodb';
import Product from '@/models/Product';

export default function Home({ products = [], saleProducts = [] }) {
  return (
    <main>
      <section className="py-20 hero-gradient">
        <div className="max-w-7xl mx-auto px-4 grid md:grid-cols-2 gap-8 items-center">
          <div>
            <h1 className="text-5xl font-extrabold mb-4 text-gray-800">Quality Stationery, Delivered</h1>
            <p className="text-lg text-gray-700 mb-6">Everything your school, office or creative studio needs — curated with care.</p>
            <Link href="/shop" className="inline-block btn-primary px-6 py-3 rounded-full font-semibold">Shop Now</Link>
          </div>
          <div className="block">
            {/* stationery illustration/photo - reduced height for better balance */}
            <img src="/images/sample1.svg" alt="stationery" className="w-full h-auto max-h-[280px] object-contain" />
          </div>
        </div>
      </section>

      {products && products.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 py-16">
          <h2 className="text-2xl font-bold mb-6 text-gray-800">Featured Products</h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map((p, i) => (
              <ProductCard key={p.sku || i} product={p} />
            ))}
          </div>
        </section>
      )}

      {saleProducts && saleProducts.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 py-16">
          <h2 className="text-2xl font-bold mb-6 text-red-600">On Sale</h2>
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
