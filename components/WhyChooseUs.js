const items = ['Genuine Products','Affordable Prices','Easy Online Ordering','Useful Daily Essentials','Helpful Customer Support','Trusted Local Store'];

export default function WhyChooseUs(){
  return (
    <section className="py-8 md:py-10">
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-5 text-center md:text-left">
          <div className="page-section-kicker">Why choose us</div>
          <h2 className="text-xl md:text-3xl font-black mt-2 text-slate-900">A simple stationery shop for everyday needs</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {items.map((item) => (
            <div key={item} className="premium-card flex-row items-center justify-start gap-3 text-left">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-lg">✓</span>
              <span className="text-sm md:text-base font-semibold text-slate-700">{item}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
