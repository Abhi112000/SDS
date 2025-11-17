import dbConnect from '@/lib/mongodb';
import Order from '@/models/Order';
import GuestOrder from '@/models/GuestOrder';
import User from '@/models/User';
import Message from '@/models/Message';
import { getSession } from 'next-auth/react';

export default async function handler(req,res){
  await dbConnect();
  const session = await getSession({ req });
  if(!session || session.user.role !== 'admin') return res.status(403).json({ error: 'admin required' });
  const orders = await Order.countDocuments();
  const guestOrders = await GuestOrder.countDocuments();
  const users = await User.countDocuments();
  const messages = await Message.countDocuments({ read: false });
  // recent 7 days orders count
  const weekAgo = new Date(Date.now() - 7*24*60*60*1000);
  const recent = await Order.aggregate([ { $match: { createdAt: { $gte: weekAgo } } }, { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } }, { $sort: { _id: 1 } } ]);
  return res.status(200).json({ orders, guestOrders, users, unreadMessages: messages, recent });
}
