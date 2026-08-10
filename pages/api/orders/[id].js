import dbConnect from '@/lib/mongodb';
import Order from '@/models/Order';
import pusher from '@/lib/pusher';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';

const allowedStatuses = ['new','processing','shipped','delivered','cancelled'];

export default async function handler(req,res){
  await dbConnect();
  if(req.method !== 'PUT') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if(!session || session.user?.role !== 'admin') return res.status(403).json({ error: 'admin required' });

  const { id } = req.query;
  const { status } = req.body || {};
  if(!status || !allowedStatuses.includes(status)){
    return res.status(400).json({ error: 'Invalid status' });
  }

  try{
    const order = await Order.findByIdAndUpdate(id, { status, updatedAt: new Date() }, { new: true }).lean();
    if(!order) return res.status(404).json({ error: 'Order not found' });
    if(order.userId){
      try{ await pusher.trigger(`user-${order.userId}`, 'order-status-updated', { orderId: order._id, status }); }catch(e){ console.warn('pusher order update failed', e?.message || e); }
    }
    return res.status(200).json({ ok:true, order });
  }catch(e){
    console.error('order status update failed', e);
    return res.status(500).json({ error: 'Unable to update order status', details: e.message });
  }
}
