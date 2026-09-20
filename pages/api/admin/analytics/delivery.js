import dbConnect from '@/lib/mongodb';
import Order from '@/models/Order';
import Product from '@/models/Product';
import { getSession } from 'next-auth/react';
import { getToken } from 'next-auth/jwt';

export default async function handler(req, res){
  // simple admin guard (reuse token/session pattern if needed)
  // this endpoint is intended for internal admin UI; rely on existing app auth in UI
  // auth: allow admin users only (session or JWT)
  const session = await getSession({ req });
  let token = null;
  if (!session) {
    try { token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET }); } catch (e) { token = null; }
  }
  const isAdmin = (session && session.user && session.user.role === 'admin') || (token && (token.role === 'admin' || (token.user && token.user.role === 'admin')));
  if (!isAdmin) return res.status(401).json({ error: 'Unauthorized' });

  await dbConnect();
  try{
    const { start, end, lastDays } = req.query;
    let startDate = null, endDate = new Date();
    if(start) startDate = new Date(start);
    if(end) endDate = new Date(end);
    if(!startDate){
      const days = Number(lastDays || 30);
      startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
    }

    const match = { createdAt: { $gte: startDate, $lte: endDate } };

    const totals = await Order.aggregate([
      { $match: match },
      { $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        homeDeliveryOrders: { $sum: { $cond: [ { $gt: [ "$deliveryCharge", 0 ] }, 1, 0 ] } },
        selfPickupOrders: { $sum: { $cond: [ { $or: [ { $eq: [ "$deliveryCharge", 0 ] }, { $not: [ "$deliveryCharge" ] } ] }, 1, 0 ] } },
        cancelledOrders: { $sum: { $cond: [ { $eq: [ "$status", "cancelled" ] }, 1, 0 ] } },
        rejectedOrders: { $sum: { $cond: [ { $eq: [ "$status", "rejected" ] }, 1, 0 ] } },
        freeDeliveryOrders: { $sum: { $cond: [ { $eq: [ "$deliveryCharge", 0 ] }, 1, 0 ] } },
        paidDeliveryOrders: { $sum: { $cond: [ { $gt: [ "$deliveryCharge", 0 ] }, 1, 0 ] } },
        totalDeliveryCharges: { $sum: { $ifNull: [ "$deliveryCharge", 0 ] } },
        totalRevenue: { $sum: { $ifNull: [ "$total", 0 ] } },
        avgOrderValue: { $avg: { $ifNull: [ "$total", 0 ] } },
        avgDeliveryDistance: { $avg: { $ifNull: [ "$deliveryDistanceKm", null ] } }
      } }
    ]).exec();

    const totalsDoc = (totals && totals[0]) || {
      totalOrders: 0, homeDeliveryOrders:0, selfPickupOrders:0, cancelledOrders:0, rejectedOrders:0, freeDeliveryOrders:0, paidDeliveryOrders:0, totalDeliveryCharges:0, totalRevenue:0, avgOrderValue:0, avgDeliveryDistance:0
    };

    // orders by day
    const ordersByDay = await Order.aggregate([
      { $match: match },
      { $project: { day: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, total: "$total" } },
      { $group: { _id: "$day", count: { $sum: 1 }, revenue: { $sum: { $ifNull: [ "$total", 0 ] } } } },
      { $sort: { _id: 1 } }
    ]).exec();

    // orders by month
    const ordersByMonth = await Order.aggregate([
      { $match: match },
      { $project: { month: { $dateToString: { format: "%Y-%m", date: "$createdAt" } }, total: "$total" } },
      { $group: { _id: "$month", count: { $sum: 1 }, revenue: { $sum: { $ifNull: [ "$total", 0 ] } } } },
      { $sort: { _id: 1 } }
    ]).exec();

    // top products
    const topProducts = await Order.aggregate([
      { $match: match },
      { $unwind: "$items" },
      { $group: { _id: "$items.productId", title: { $first: "$items.title" }, qty: { $sum: "$items.qty" }, revenue: { $sum: { $multiply: [ { $ifNull: [ "$items.price", 0 ] }, { $ifNull: [ "$items.qty", 0 ] } ] } } } },
      { $sort: { qty: -1, revenue: -1 } },
      { $limit: 20 }
    ]).exec();

    // top categories (lookup products)
    const prodCats = await Order.aggregate([
      { $match: match },
      { $unwind: "$items" },
      { $group: { _id: "$items.productId", qty: { $sum: "$items.qty" }, revenue: { $sum: { $multiply: [ { $ifNull: [ "$items.price", 0 ] }, { $ifNull: [ "$items.qty", 0 ] } ] } } } },
      { $lookup: { from: "products", localField: "_id", foreignField: "_id", as: "product" } },
      { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
      { $group: { _id: { $ifNull: [ "$product.category", "Uncategorized" ] }, qty: { $sum: "$qty" }, revenue: { $sum: "$revenue" } } },
      { $sort: { revenue: -1 } },
      { $limit: 20 }
    ]).exec();

    // locality analytics by deliveryPincode
    const locality = await Order.aggregate([
      { $match: match },
      { $group: {
        _id: { $ifNull: [ "$deliveryPincode", "Unknown" ] },
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: { $ifNull: [ "$total", 0 ] } },
        avgOrderValue: { $avg: { $ifNull: [ "$total", 0 ] } },
        freeDeliveries: { $sum: { $cond: [ { $eq: [ "$deliveryCharge", 0 ] }, 1, 0 ] } },
        paidDeliveries: { $sum: { $cond: [ { $gt: [ "$deliveryCharge", 0 ] }, 1, 0 ] } },
        lastOrderDate: { $max: "$createdAt" },
        avgDistance: { $avg: { $ifNull: [ "$deliveryDistanceKm", null ] } }
      } },
      { $project: { locality: "$_id", totalOrders:1, totalRevenue:1, avgOrderValue:1, freeDeliveries:1, paidDeliveries:1, lastOrderDate:1, avgDistance:1 } },
      { $sort: { totalOrders: -1 } },
      { $limit: 500 }
    ]).exec();

    // delivery performance placeholders (no timing fields available yet)
    const performance = {
      averageDeliveryTime: null,
      fastestDelivery: null,
      slowestDelivery: null,
      averagePreparationTime: null,
      averagePickupTime: null
    };

    // respond
    return res.status(200).json({ totals: totalsDoc, ordersByDay, ordersByMonth, topProducts, topCategories: prodCats, locality, performance });
  }catch(e){
    console.error('analytics error', e);
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
