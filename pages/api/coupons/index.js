// pages/api/coupons/index.js
import dbConnect from '@/lib/dbConnect';
import Coupon from '@/models/Coupon';

export default async function handler(req, res) {
  await dbConnect();

  if (req.method === "GET") {
    // Public coupons for UI
    // Query all coupons that are public and active and not expired
    const now = new Date();
    const coupons = await Coupon.find({
      public: true,
      active: true,
      $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: now } }]
    }).lean();
    return res.status(200).json({ ok: true, coupons });
  }

  if (req.method === "POST") {
    // Validate and reserve a coupon atomically
    // body: { code, subtotal, userId (optional) }
    const { code, subtotal } = req.body;
    if (!code) return res.status(400).json({ ok: false, error: "Code required" });

    // Find coupon
    const c = await Coupon.findOne({ code: code.toUpperCase() });
    if (!c || !c.active) return res.status(404).json({ ok: false, error: "Invalid or inactive coupon" });

    if (c.expiresAt && c.expiresAt < new Date()) return res.status(400).json({ ok: false, error: "Coupon expired" });

    // Do NOT reserve/increment usage here. Only validate and compute discount.
    // The final increment (reservation) must happen at order submission to avoid wasting uses.
    let discount = 0;
    if (c.type === "percent") {
      discount = Math.round((c.value / 100) * (subtotal || 0));
    } else {
      discount = c.value;
    }
    if (subtotal && discount > subtotal) discount = subtotal;

    return res.status(200).json({
      ok: true,
      coupon: {
        code: c.code,
        type: c.type,
        value: c.value,
        discount
      }
    });
  }

  res.status(405).end();
}
