export default function BulkOrders(){
  return (
    <section className="py-8 bg-slate-50">
      <div className="max-w-6xl mx-auto px-4">
        <div className="md:flex md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Need Stationery in Bulk?</h2>
            <p className="text-sm text-slate-700 mt-1">We provide supplies for schools, coaching institutes, offices, libraries, events and NGOs. Competitive pricing, customized quotations and timely supply.</p>
          </div>
          <div className="mt-4 md:mt-0 flex gap-2">
            <a href="/bulk-request" className="px-4 py-2 bg-indigo-600 text-white rounded">Request a Quote</a>
            <a href="/contact" className="px-4 py-2 border rounded">Contact Us</a>
          </div>
        </div>
      </div>
    </section>
  );
}
