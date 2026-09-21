const services = [
  { icon: '�', title: 'Study Essentials', desc: 'Notebook, pen, and desk items selected for everyday study and work routines.' },
  { icon: '🏪', title: 'Local Store', desc: 'A practical stationery shop with essentials for schools, offices, and homes.' },
  { icon: '📦', title: 'Bulk Orders', desc: 'Useful for schools, offices, and teams needing regular stationery supplies.' },
  { icon: '💸', title: 'Value Picks', desc: 'Affordable everyday essentials without making the shopping experience feel crowded.' }
];

export default function Services(){
  return (
    <section className="py-8 md:py-10">
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-5 text-center md:text-left">
          <div className="page-section-kicker">Why people choose us</div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
          {services.map((s) => (
            <div key={s.title} className="premium-card group text-center">
              <div className="icon-tile">{s.icon}</div>
              <div className="font-bold text-slate-900 text-base md:text-lg mt-3">{s.title}</div>
              <div className="text-sm text-slate-600 mt-2 leading-6">{s.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
