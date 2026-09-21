const cats = [
  { name: 'School Supplies', icon: '📚', accent: 'from-amber-100 to-yellow-100' },
  { name: 'Office Supplies', icon: '🖊️', accent: 'from-sky-100 to-cyan-100' },
  { name: 'Pens & Pencils', icon: '✏️', accent: 'from-violet-100 to-indigo-100' },
  { name: 'Notebooks', icon: '📓', accent: 'from-red-100 to-rose-100' },
  { name: 'Art & Craft', icon: '🎨', accent: 'from-pink-100 to-fuchsia-100' },
  { name: 'Files & Folders', icon: '🗂️', accent: 'from-emerald-100 to-green-100' },
  { name: 'Printing', icon: '🖨️', accent: 'from-slate-100 to-zinc-100' },
  { name: 'Gift Items', icon: '🎁', accent: 'from-orange-100 to-amber-100' }
];

export default function FeaturedCategories(){
  return (
    <section className="py-8 md:py-10">
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-5 text-center md:text-left">
          <div className="page-section-kicker">Browse by need</div>
          <h2 className="text-xl md:text-3xl font-black mt-2 text-slate-900">Featured Categories</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
          {cats.map((cat) => (
            <div key={cat.name} className={`group rounded-[1.5rem] border border-slate-200 bg-gradient-to-br ${cat.accent} p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-lg`}>
              <div className="text-3xl md:text-4xl">{cat.icon}</div>
              <div className="mt-3 text-sm md:text-base font-bold text-slate-800">{cat.name}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
