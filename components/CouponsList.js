import { useEffect, useState } from "react";
import { useToast } from '@/components/Toast';

export default function CouponsList({ onApply }) {
  const [coupons, setCoupons] = useState([]);
  const toast = useToast();
  useEffect(() => {
    fetch("/api/coupons")
      .then((r) => r.json())
      .then((d) => {
        if (d?.ok) setCoupons(d.coupons || []);
      });
  }, []);

  if (!coupons || coupons.length === 0) return null;

  return (
    <div className="bg-white p-3 rounded shadow">
      <h4 className="font-semibold mb-2">Available Coupons</h4>
      <div className="grid gap-2">
        {coupons.map((c) => (
          <div key={c._id} className="flex items-center justify-between border p-2 rounded">
            <div>
              <div className="font-medium">{c.code}</div>
              <div className="text-sm text-gray-500">{c.type === "percent" ? `${c.value}% off` : `₹${c.value} off`}</div>
            </div>
            <button
              onClick={async () => {
                // Validate coupon and get discount amount (server will reserve it)
                const resp = await fetch("/api/coupons", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ code: c.code, subtotal: 0 }) // subtotal pass later from cart
                }).then(r => r.json());
                if (!resp.ok) return toast?.push?.({ message: (resp.error || "Could not apply coupon"), type: 'error' });
                onApply(resp.coupon);
              }}
              className="px-3 py-1 btn-primary rounded"
            >
              Apply
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
