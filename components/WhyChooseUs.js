const items = ['Genuine Products','Affordable Prices','Fast Local Delivery','Easy Online Ordering','Friendly Customer Support','Trusted Local Business'];

export default function WhyChooseUs(){
  return (
    <section className="py-8">
      <div className="max-w-6xl mx-auto px-4">
        <h2 className="text-xl font-semibold mb-4">Why Choose Us</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {items.map(i=> <div key={i} className="bg-white p-4 rounded shadow text-sm">✔ {i}</div>)}
        </div>
      </div>
    </section>
  );
}
