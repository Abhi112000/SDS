export default function HowItWorks(){
  const steps = ['Browse Products','Add to Cart','Choose Delivery or Self Pickup','Place Order','Receive Delivery or Collect from Shop'];
  return (
    <section className="py-8 bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 text-center">
        <h2 className="text-xl font-semibold mb-4">How It Works</h2>
        <ol className="space-y-3 text-sm">
          {steps.map((s,i)=> <li key={s} className="p-3 bg-white rounded shadow">{i+1}. {s}</li>)}
        </ol>
      </div>
    </section>
  );
}
