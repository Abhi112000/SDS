// pages/api/orders/index.js
import dbConnect from "@/lib/mongodb";
import Order from "../../../models/Order";
import Coupon from "../../../models/Coupon";
import GuestOrder from '../../../models/GuestOrder';
import pusher from "../../../lib/pusher";
import { getSession } from "next-auth/react";
import { getToken } from "next-auth/jwt";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method === "GET") {
    const session = await getSession({ req });
    if (req.query.admin === "true") {
      const role = session?.user?.role;
      if (!role || role !== 'admin') return res.status(403).json({ error: 'admin required' });
      const orders = await Order.find({}).sort({ createdAt: -1 }).limit(200).lean();
      return res.status(200).json(orders);
    }
    if (!session) return res.status(403).json([]);
    const orders = await Order.find({ userId: session.user.id }).sort({ createdAt: -1 }).lean();
    return res.status(200).json(orders);
  }

  if (req.method === "POST") {
  let session = await getSession({ req });
  // fallback to token when session is not available (server-side JWT)
  if(!session){
    try{
      const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
      if(token && token.sub){
        session = { user: { id: token.sub, role: token.role || 'user' } };
      }
    }catch(e){ /* ignore */ }
  }
  const { items, subtotal, couponCode, name, phone, email, address, locationUrl, whatsapp } = req.body;

    if (!name || !phone || !address) return res.status(400).json({ error: "Missing required fields" });
    // Validate items - basic
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: "Cart is empty" });

    let couponResult = null;
    if (couponCode) {
      // Validate existence and expiry first
      const coupon = await Coupon.findOne({ code: couponCode.toUpperCase(), active: true });
      if (!coupon) return res.status(400).json({ error: "Invalid coupon" });
      if (coupon.expiresAt && coupon.expiresAt < new Date()) return res.status(400).json({ error: "Coupon expired" });

      // Atomically increment usedCount only if there are remaining uses.
      // This avoids race conditions where multiple orders try to use the last coupon simultaneously.
      const updated = await Coupon.findOneAndUpdate(
        { _id: coupon._id, usedCount: { $lt: coupon.maxUses } },
        {
          $inc: { usedCount: 1 },
          $set: { active: (coupon.usedCount + 1) >= coupon.maxUses ? false : coupon.active }
        },
        { new: true }
      );

      if (!updated) return res.status(400).json({ error: "Coupon could not be applied (race or exhausted)" });

      const discount = updated.type === "percent" ? Math.round((updated.value / 100) * (subtotal || 0)) : updated.value;
      couponResult = { code: updated.code, discountAmount: discount };
    }

    let order;
    if(!session){
      const g = await GuestOrder.create({ items, subtotal, coupon: couponResult, name, phone, email, address, locationUrl, whatsapp });
      order = g;
    } else {
      // Save as a user order and also include profile fields for admin visibility
      order = await Order.create({
        userId: session?.user?.id || null,
        guest: false,
        items,
        subtotal,
        coupon: couponResult,
        name,
        phone,
        email,
        address,
        locationUrl,
        whatsapp,
        createdAt: new Date()
      });
    }

    // notify admin realtime
    try {
      await pusher.trigger("admin-channel", "new-order", {
        orderId: order._id,
        guest: !session,
        name,
        subtotal,
        phone,
        whatsapp,
        items
      });
    } catch (e) {
      console.warn("Pusher notify failed:", e?.message || e);
    }

    return res.status(201).json({ ok: true, orderId: order._id, couponApplied: !!couponResult });
  }

  res.status(405).end();
}
