export default function ContactSection(){
  return (
    <section className="py-8 bg-white">
      <div className="max-w-6xl mx-auto px-4 md:flex md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Contact Us</h2>
          <div className="text-sm text-slate-700 mt-1">Shree Durga Stationary<br/>Shop Address here<br/>Phone: 91-XXXXXXXXXX<br/>Business hours: 9:00 AM – 8:00 PM</div>
        </div>
        <div className="mt-4 md:mt-0 flex gap-2">
          <a href="tel:919818630972" className="px-4 py-2 bg-emerald-600 text-white rounded">Call Now</a>
          <a href="https://wa.me/919818630972" className="px-4 py-2 bg-green-600 text-white rounded">WhatsApp</a>
        </div>
      </div>
    </section>
  );
}
