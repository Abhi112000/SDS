import sample from '@/data/sample_products.json';

export default function FeaturedProducts(){
  const items = (sample && sample.slice ? sample.slice(0,8) : []);
  return (
    <section className="py-8 bg-white">
      <div className="max-w-6xl mx-auto px-4">
        <h2 className="text-xl font-semibold mb-4">Featured Products</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {items.map((p,i)=> (
            <div key={p.id || i} className="bg-white p-3 rounded shadow text-center">
              <img src={p.image || '/images/product-placeholder.png'} alt={p.title || 'Product'} className="mx-auto h-36 object-contain mb-3" />
              <div className="font-medium">{p.title}</div>
              <div className="text-sm text-slate-600">₹{(p.price||0).toFixed(2)}</div>
              <button className="mt-2 px-3 py-1 bg-indigo-600 text-white rounded text-sm">Add to Cart</button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
