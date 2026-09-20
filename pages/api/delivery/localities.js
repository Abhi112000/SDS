import dbConnect from '@/lib/mongodb';
import Order from '@/models/Order';

export default async function handler(req, res){
  await dbConnect();
  try{
    const { page = '1', pageSize = '100', sort = 'totalOrders', order = 'desc' } = req.query;
    const p = Math.max(1, Number(page||1));
    const ps = Math.max(10, Math.min(500, Number(pageSize||100)));
    const sortField = String(sort || 'totalOrders');
    const sortOrder = order === 'asc' ? 1 : -1;

    const agg = [
      { $match: { deliveryPincode: { $ne: null } } },
      { $group: {
        _id: '$deliveryPincode',
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: { $ifNull: [ '$total', 0 ] } },
        avgDistance: { $avg: { $ifNull: [ '$deliveryDistanceKm', null ] } },
        freeDeliveries: { $sum: { $cond: [ { $eq: [ '$deliveryCharge', 0 ] }, 1, 0 ] } },
        paidDeliveries: { $sum: { $cond: [ { $gt: [ '$deliveryCharge', 0 ] }, 1, 0 ] } },
        lastOrderDate: { $max: '$createdAt' }
      } },
      { $project: { locality: '$_id', totalOrders:1, totalRevenue:1, avgDistance:1, freeDeliveries:1, paidDeliveries:1, lastOrderDate:1 } }
    ];

    // count total groups
    const countAgg = await Order.aggregate([ { $match: { deliveryPincode: { $ne: null } } }, { $group: { _id: '$deliveryPincode' } }, { $count: 'total' } ]).exec();
    const total = (countAgg && countAgg[0] && countAgg[0].total) || 0;

    // apply sort & pagination
    const sortStage = { $sort: { [sortField]: sortOrder } };
    agg.push(sortStage);
    agg.push({ $skip: (p-1) * ps });
    agg.push({ $limit: ps });

    const items = await Order.aggregate(agg).exec();

    return res.status(200).json({ total, items });
  }catch(e){
    console.error('localities error', e);
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
