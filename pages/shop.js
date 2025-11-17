import Link from "next/link";
import Breadcrumbs from '../components/Breadcrumbs';
import { useRouter } from 'next/router';
import ProductCard from "../components/ProductCard";
import dbConnect from '@/lib/dbConnect';
import Product from '@/models/Product';
import { useEffect, useState } from 'react';

export default function Shop({ products = [] }) {
  const router = useRouter();
  return (
    <main className="max-w-7xl mx-auto px-4 py-10">
      <Breadcrumbs items={[{ label: 'Shop' }]} />
      <button onClick={() => router.back()} className="mb-4 px-4 py-2 btn-secondary rounded">Back</button>
      <h1 className="text-3xl font-bold text-gray-800 mb-8">Our Products</h1>

      <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {products.map((product) => (
          <div key={product._id}>
            <ProductCard product={product} />
          </div>
        ))}
      </div>

      <div className="text-center mt-10">
        <Link
          href="/contact"
          className="inline-block px-6 py-3 rounded-lg btn-primary"
        >
          Need Help? Contact Us
        </Link>
      </div>
    </main>
  );
}

export async function getServerSideProps(){
  await dbConnect();
  const products = await Product.find({}).lean();
  return { props: { products: JSON.parse(JSON.stringify(products || [])) } };
}
