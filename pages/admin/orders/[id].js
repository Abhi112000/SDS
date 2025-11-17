import { getSession } from 'next-auth/react';
import dbConnect from '@/lib/mongodb';
import Order from '../../../models/Order';
import Message from '../../../models/Message';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

export default function AdminOrderDetail({ initialOrder, initialMessages }){
  const router = useRouter();
  const [order, setOrder] = useState(initialOrder);
  const [messages, setMessages] = useState(initialMessages || []);

  useEffect(()=>{ /* placeholder for any client-side refresh */ },[]);

  return (
    <div className="p-6">
      <button onClick={()=>router.push('/admin')} className="mb-4 px-3 py-1 border rounded">Back</button>
      <h1 className="text-2xl font-bold mb-4">Order {order._id}</h1>
      <div className="bg-white p-4 rounded shadow mb-4">
        <div><strong>Customer:</strong> {order.customerName || order.userName || order.customerEmail}</div>
        <div><strong>Phone:</strong> {order.whatsapp || order.phone || ''}</div>
        <div><strong>Address:</strong> {order.address || ''}</div>
        <div className="mt-2"><strong>Items:</strong>
          <ul className="list-disc ml-6 mt-2">
            {(order.items||[]).map(i=> <li key={i._id || i.sku}>{i.title} × {i.qty} — ₹{i.price}</li>)}
          </ul>
        </div>
      </div>

      <h2 className="text-xl font-semibold mb-2">Related messages</h2>
      <div className="space-y-3">
        {messages.map(m=> (
          <div key={m._id} className="card">
            <div className="font-semibold">{m.subject}</div>
            <div className="text-sm text-gray-600">From: {m.fromName} • {new Date(m.createdAt).toLocaleString()}</div>
            <div className="mt-2 text-sm">{m.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export async function getServerSideProps(ctx){
  const session = await getSession(ctx);
  if(!session || session.user.role !== 'admin') return { redirect: { destination: '/login', permanent: false } };
  const { id } = ctx.params;
  await dbConnect();
  const order = await Order.findById(id).lean();
  const messages = await Message.find({ orderId: id }).sort({ createdAt:-1 }).lean();
  return { props: { initialOrder: JSON.parse(JSON.stringify(order || {})), initialMessages: JSON.parse(JSON.stringify(messages || [])) } };
}
