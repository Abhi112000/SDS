export default function Hero({ onShop, onContact }){
  return (
    <section className="bg-gradient-to-r from-white via-slate-50 to-white py-12">
      <div className="max-w-6xl mx-auto px-4 text-center">
        <div className="bg-[url('/images/hero-bg.jpg')] bg-cover bg-center rounded-lg p-8 md:p-12 shadow-sm" style={{backgroundColor:'rgba(255,255,255,0.9)'}}>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3">Everything You Need for School, Office & Daily Stationery</h1>
          <p className="text-sm sm:text-base text-slate-700 mb-6">Quality stationery at affordable prices with fast local delivery and convenient self pickup.</p>
          <div className="flex justify-center gap-3 flex-col sm:flex-row">
            <button onClick={onShop} className="px-6 py-3 bg-indigo-600 text-white rounded shadow">Shop Now</button>
            <button onClick={onContact} className="px-6 py-3 border rounded">Contact Us</button>
          </div>
        </div>
      </div>
    </section>
  );
}
