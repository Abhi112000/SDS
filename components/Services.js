const services = [
  { icon: '🚚', title: 'Fast Local Delivery', desc: 'Quick delivery within our serviceable areas.' },
  { icon: '🏪', title: 'Self Pickup', desc: 'Order online and collect from our shop.' },
  { icon: '📦', title: 'Bulk Orders', desc: 'Special pricing for schools, institutes and businesses.' },
  { icon: '💳', title: 'Secure Payments', desc: 'Safe online payments and Cash on Delivery.' }
];

export default function Services(){
  return (
    <section className="py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {services.map(s=> (
            <div key={s.title} className="bg-white p-4 rounded shadow text-center">
              <div className="text-3xl mb-2">{s.icon}</div>
              <div className="font-semibold">{s.title}</div>
              <div className="text-sm text-slate-600 mt-1">{s.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
