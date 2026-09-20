export default function DeliveryInfo(){
  return (
    <section className="py-8 bg-white">
      <div className="max-w-6xl mx-auto px-4">
        <h2 className="text-xl font-semibold mb-3">Delivery Information</h2>
        <ul className="list-disc ml-6 text-sm text-slate-700 space-y-1">
          <li>Delivery available only in selected serviceable areas.</li>
          <li>Free Delivery within the configured delivery radius.</li>
          <li>Delivery charges may apply depending on locality.</li>
          <li>Minimum order amount may apply.</li>
          <li>Self Pickup available during shop timings.</li>
        </ul>
        <div className="mt-4 flex gap-3">
          <a href="#delivery-check" className="px-4 py-2 bg-indigo-600 text-white rounded">Check Delivery Availability</a>
          <a href="/delivery-info" className="px-4 py-2 border rounded">Learn More</a>
        </div>
      </div>
    </section>
  );
}
