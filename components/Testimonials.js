const sample = [
  { name: 'Rashmi', rating: 5, text: 'Great service and fast delivery!' },
  { name: 'Amit', rating: 5, text: 'Excellent stationery collection.' },
  { name: 'Priya', rating: 4, text: 'Good prices and friendly staff.' }
];

export default function Testimonials(){
  return (
    <section className="py-8 bg-slate-50">
      <div className="max-w-6xl mx-auto px-4">
        <h2 className="text-xl font-semibold mb-4">Customer Testimonials</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {sample.map(s=> (
            <div key={s.name} className="bg-white p-4 rounded shadow">
              <div className="font-semibold">{s.name}</div>
              <div className="text-yellow-500 mb-2">{'★'.repeat(s.rating)}</div>
              <div className="text-sm text-slate-700">{s.text}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
