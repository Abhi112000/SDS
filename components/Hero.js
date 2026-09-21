export default function Hero({ onShop, onContact }){
  return (
    <section className="bg-gradient-to-r from-white via-slate-50 to-white py-6 md:py-8">
      <div className="max-w-6xl mx-auto px-3 text-center">
        <div className="bg-[url('/images/hero-bg.jpg')] bg-cover bg-center rounded-lg p-5 md:p-8 shadow-sm" style={{backgroundColor:'rgba(255,255,255,0.9)'}}>
          <h1 className="text-2xl sm:text-3xl md:text-[2.2rem] font-bold mb-2 md:mb-3">Everything You Need for School, Office & Daily Stationery</h1>
          <p className="text-sm sm:text-base text-slate-700 mb-4 md:mb-5">Quality stationery at affordable prices with fast local delivery and convenient self pickup.</p>
          <div className="flex justify-center gap-2.5 flex-col sm:flex-row">
            <button onClick={onShop} className="px-5 py-2.5 bg-indigo-600 text-white rounded shadow text-sm md:text-base">Shop Now</button>
            <button onClick={onContact} className="px-5 py-2.5 border rounded text-sm md:text-base">Contact Us</button>
          </div>
        </div>
      </div>
    </section>
  );
}
