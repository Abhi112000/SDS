import dbConnect from '@/lib/mongodb';
import Order from '@/models/Order';
import pusher from '@/lib/pusher';
import { getSession } from 'next-auth/react';

export default async function handler(req,res){
  await dbConnect();
  const session = await getSession({ req });
  if(req.method === 'PUT'){
    if(!session || session.user.role !== 'admin') return res.status(403).end();
    const { id } = req.query; const { status } = req.body;
    const order = await Order.findByIdAndUpdate(id, { status, updatedAt: new Date() }, { new: true });
    if(order.userId) await pusher.trigger(`user-${order.userId}`, 'order-status-updated', { orderId: order._id, status });
    return res.status(200).json({ ok:true, order });
  }
  res.status(405).end();
}
