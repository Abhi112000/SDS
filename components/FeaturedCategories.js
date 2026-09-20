const cats = ['School Supplies','Office Supplies','Pens & Pencils','Registers & Notebooks','Art & Craft','Printing & Photocopy','Files & Folders','Gift Items'];

export default function FeaturedCategories(){
  return (
    <section className="py-8">
      <div className="max-w-6xl mx-auto px-4">
        <h2 className="text-xl font-semibold mb-4">Featured Categories</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {cats.map(c=> <div key={c} className="bg-white p-4 rounded text-center shadow">{c}</div>)}
        </div>
      </div>
    </section>
  );
}
