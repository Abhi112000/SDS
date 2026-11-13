// pages/api/orders/index.js
import dbConnect from "@/lib/mongodb";
import mongoose from 'mongoose';
import Product from '@/models/Product';
import Order from "../../../models/Order";
import Coupon from "../../../models/Coupon";
import GuestOrder from '../../../models/GuestOrder';
import pusher from "../../../lib/pusher";
import { getSession } from "next-auth/react";
import { getToken } from "next-auth/jwt";
import Invoice from '@/models/Invoice';

export default async function handler(req, res) {
  await dbConnect();

  if (req.method === "GET") {
    const session = await getSession({ req });
    if (req.query.admin === "true") {
      const role = session?.user?.role;
      if (!role || role !== 'admin') return res.status(403).json({ error: 'admin required' });
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
      const [orders, total] = await Promise.all([
        Order.find({}).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
        Order.countDocuments({})
      ]);
      return res.status(200).json({ orders, total, page, limit });
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
  const { items, couponCode, name, phone, email, address, deliveryPincode, locationUrl, whatsapp, deliveryLatitude, deliveryLongitude, deliveryDistanceKm, deliveryRoughDistanceKm, deliveryLocationPending, deliveryCharge } = req.body;

    if (!name || !phone || !address) return res.status(400).json({ error: "Missing required fields" });
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: "Cart is empty" });

    const normalizedItems = [];
    for(const entry of items){
      const productId = String(entry?.productId || entry?.id || '');
      const quantity = Number(entry?.qty);
      if(!productId || !Number.isInteger(quantity) || quantity <= 0) return res.status(400).json({ error: 'Each item must have a product and a positive whole-number quantity' });
      let product = null;
      if(mongoose.Types.ObjectId.isValid(productId)){
        product = await Product.findById(productId).lean();
      }
      if(!product){
        const matches = await Product.find({ sku: new RegExp(`^${productId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }).limit(2).lean();
        if(matches.length > 1) return res.status(400).json({ error: `Product SKU ${productId} is ambiguous` });
        product = matches[0] || null;
      }
      if(!product) return res.status(400).json({ error: `Product ${productId} is no longer available` });
      const hasSaleTag = Array.isArray(product.tags) && product.tags.includes('SALE!');
      const price = Number(product.salePrice !== undefined && (product.onSale || hasSaleTag) ? product.salePrice : product.price);
      if(!Number.isFinite(price) || price < 0) return res.status(400).json({ error: `Product ${product.title} has an invalid price` });
      normalizedItems.push({ productId: String(product._id), title: product.title || 'Product', qty: quantity, price });
    }
    const calculatedSubtotal = Number(normalizedItems.reduce((sum, item) => sum + item.price * item.qty, 0).toFixed(2));
    const deliveryChargeAmount = Number(deliveryCharge ?? 0);
    if(!Number.isFinite(deliveryChargeAmount) || deliveryChargeAmount < 0) return res.status(400).json({ error: 'Invalid delivery charge' });

    let couponResult = null;
    let couponToReserve = null;
    let couponMaxUses = 0;
    if (couponCode) {
      const coupon = await Coupon.findOne({ code: String(couponCode).trim().toUpperCase(), active: true });
      if (!coupon) return res.status(400).json({ error: "Invalid coupon" });
      if (coupon.expiresAt && coupon.expiresAt < new Date()) return res.status(400).json({ error: "Coupon expired" });
      if(!coupon.public){
        const userId = session?.user?.id || session?.user?._id;
        if(!userId || !coupon.allowedUserIds?.includes(String(userId))) return res.status(403).json({ error: 'Coupon not available for this user' });
      }
      const maxUses = Number(coupon.maxUses ?? 1);
      if(Number(coupon.usedCount || 0) >= maxUses) return res.status(400).json({ error: 'Coupon exhausted' });
      const discount = Math.min(calculatedSubtotal, coupon.type === "percent" ? Math.round((coupon.value / 100) * calculatedSubtotal) : Number(coupon.value || 0));
      couponResult = { code: coupon.code, discountAmount: Math.max(0, discount) };
      couponToReserve = coupon;
      couponMaxUses = maxUses;
    }

    const totalAmount = Math.max(0, Number((calculatedSubtotal + deliveryChargeAmount - (couponResult?.discountAmount || 0)).toFixed(2)));

    let order;
    let couponReserved = false;
    const orderData = {
        items: normalizedItems,
        subtotal: calculatedSubtotal,
        coupon: couponResult,
        name,
        phone,
        email,
        address,
        deliveryPincode,
        locationUrl,
        whatsapp,
        deliveryLatitude,
        deliveryLongitude,
        deliveryDistanceKm,
        deliveryRoughDistanceKm,
        deliveryLocationPending,
        deliveryCharge: deliveryChargeAmount,
        total: totalAmount
    };
    try {
      if(!session){
        order = await GuestOrder.create(orderData);
      } else {
        order = await Order.create({
        ...orderData,
        userId: session?.user?.id || null,
        guest: false,
        createdAt: new Date()
      });
      }
      if(couponToReserve){
        const updatedCoupon = await Coupon.findOneAndUpdate(
          { _id: couponToReserve._id, active: true, usedCount: { $lt: couponMaxUses }, $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: new Date() } }] },
          { $inc: { usedCount: 1 } },
          { new: true }
        );
        if(!updatedCoupon){
          await (session ? Order.findByIdAndDelete(order._id) : GuestOrder.findByIdAndDelete(order._id));
          return res.status(409).json({ error: 'Coupon could not be applied (race or exhausted)' });
        }
        couponReserved = true;
        if(updatedCoupon.usedCount >= couponMaxUses){
          await Coupon.updateOne({ _id: updatedCoupon._id, usedCount: updatedCoupon.usedCount }, { $set: { active: false } });
        }
      }
    } catch(error) {
      if(order && couponReserved){
        await Coupon.updateOne({ _id: couponToReserve._id, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 }, $set: { active: true } });
      }
      if(order) await (session ? Order.findByIdAndDelete(order._id) : GuestOrder.findByIdAndDelete(order._id));
      throw error;
    }

    // notify admin realtime
    try {
      await pusher.trigger("admin-channel", "new-order", {
        orderId: order._id,
        guest: !session,
        name,
        subtotal: calculatedSubtotal,
        phone,
        whatsapp,
        items: normalizedItems
      });
    } catch (e) {
      console.warn("Pusher notify failed:", e?.message || e);
    }

    // create an invoice record for this order so invoice ID matches order ID for easy reference
    try{
      const invoiceId = String(order._id);
      const invDoc = await Invoice.create({
        invoiceId,
        type: 'order',
        orderId: String(order._id),
        payload: order,
        subtotal: calculatedSubtotal,
        discount: Number(couponResult?.discountAmount || 0),
        shipping: Number(deliveryChargeAmount || 0),
        total: Number(totalAmount || 0),
        createdBy: session?.user?.id || null
      }).catch(()=>null);
    }catch(e){ console.warn('create invoice on order failed', e?.message || e); }

    return res.status(201).json({
      ok: true,
      orderId: order._id,
      couponApplied: !!couponResult,
      items: normalizedItems,
      subtotal: calculatedSubtotal,
      coupon: couponResult,
      deliveryCharge: deliveryChargeAmount,
      total: totalAmount
    });
  }

  res.status(405).end();
}
