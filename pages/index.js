import Link from "next/link";
import ProductCard from "../components/ProductCard";
import { useEffect, useState } from 'react';
import fs from 'fs';
import path from 'path';

export default function Home({ products = [] }) {
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

      <section className="max-w-7xl mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">Featured Products</h2>
        
        <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {products.map((p, i) => (
            <ProductCard key={p.sku || i} product={p} />
          ))}
        </div>
      </section>
    </main>
  );
}

export async function getStaticProps() {
  const p = path.join(process.cwd(), 'data', 'sample_products.json');
  let products = [];
  try {
    products = JSON.parse(fs.readFileSync(p, 'utf8'));
    products = products.filter((x) => x.featured);
  } catch (e) {
    console.warn('Could not read sample products:', e.message || e);
  }

  return { props: { products } };
}
