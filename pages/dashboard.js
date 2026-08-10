import { getSession } from 'next-auth/react';
import dbConnect from '@/lib/mongodb';
import Order from '@/models/Order';
import User from '@/models/User';
import { useEffect, useState } from 'react';
import Pusher from 'pusher-js';
import { useToast } from '../components/Toast';
import Breadcrumbs from '../components/Breadcrumbs';
import { useRouter } from 'next/router';

const formatDate = (value) => {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }).format(new Date(value));
  } catch (e) {
    return String(value);
  }
};

export default function Dashboard({ user, orders }) {
  const router = useRouter();
  const [orderList, setOrderList] = useState(orders || []);
  const toast = useToast();

  const adminWhatsApp = process.env.NEXT_PUBLIC_OWNER_WHATSAPP_NUMBER || '919818630972';
  const formatDateTime = value => {
    try {
      return new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).format(new Date(value));
    } catch (e) {
      return String(value);
    }
  };

  const getWhatsAppHref = text => {
    const phone = String(adminWhatsApp).replace(/\D/g, '');
    if (!phone) return null;
    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  };

  const buildOrderSummary = (order, action) => {
    const lines = [];
    lines.push('GENERAL ENQUIRY');
    if (action) lines.push(action, '');
    lines.push(`Order ID: ${order._id}`);
    lines.push(`Date: ${formatDateTime(order.createdAt)}`);
    lines.push(`Status: ${order.status}`);
    lines.push(`Customer: ${user?.name || ''}`);
    lines.push(`Email: ${user?.email || ''}`);
    lines.push(`Phone: ${user?.phone || ''}`);
    if (order.address) lines.push(`Address: ${order.address}`);
    lines.push('', 'Items:');
    (order.items || []).forEach(item => {
      lines.push(`• ${item.title} x ${item.qty || 1} @ ₹${item.price || 0} = ₹${(((item.qty || 1) * (item.price || 0)) || 0).toFixed(2)}`);
    });
    lines.push('', `Subtotal: ₹${Number(order.subtotal || 0).toFixed(2)}`);
    lines.push(`Discount: ₹${Number(order.coupon?.discountAmount || 0).toFixed(2)}`);
    const total = Number(order.total ?? ((order.subtotal || 0) - (order.coupon?.discountAmount || 0)));
    lines.push(`Total: ₹${total.toFixed(2)}`);
    lines.push('', 'Please respond on WhatsApp.');
    return lines.join('\n');
  };

  const buildGeneralEnquiry = () => {
    const lines = [
      'GENERAL ENQUIRY',
      '',
      `Name: ${user?.name || ''}`,
      `Email: ${user?.email || ''}`,
      `Phone: ${user?.phone || ''}`,
      '',
      'Please write your enquiry here:'
    ];
    return lines.join('\n');
  };

  useEffect(() => {
    if (!user?.id) return;
    try {
      const p = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY || '', { cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || '' });
      const channel = p.subscribe(`user-${user.id}`);
      channel.bind('order-status-updated', (data) => {
        setOrderList((prev) => prev.map(o => (o._id === data.orderId ? { ...o, status: data.status } : o)));
      });
      return () => { channel.unsubscribe(); p.disconnect(); };
    } catch (e) {
      // pusher not configured; ignore
    }
  }, [user]);

  return (
    <div className="p-6">
      <Breadcrumbs items={[{ label: 'Dashboard' }]} />
      <button onClick={() => router.back()} className="mb-4 px-4 py-2 btn-secondary rounded">Back</button>
      <h1 className="text-2xl font-bold mb-4">My Dashboard</h1>
      <section className="mb-6">
        <h2 className="text-lg font-semibold">Profile</h2>
        <div className="bg-white p-4 rounded shadow max-w-xl">
          <p><strong>Name:</strong> {user?.name}</p>
          <p><strong>Email:</strong> {user?.email}</p>
          <p><strong>Phone:</strong> {user?.phone || '-'}</p>
          <p><strong>Address:</strong> {user?.address || '-'}</p>
        </div>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-semibold">Active Orders</h2>
        <div className="space-y-3 mt-3">
          {orderList.length === 0 && <div className="text-sm text-gray-500">No orders yet</div>}
          {orderList.map(o => {
            const isCancelable = ['new','processing'].includes(o.status);
            const supportText = isCancelable
              ? buildOrderSummary(o, 'I would like to cancel this order before it ships. Please process my request.')
              : buildOrderSummary(o, 'I would like to request a cancellation after the order has shipped. Please advise what to do.');
            return (
              <div key={o._id} className="bg-white p-3 rounded shadow">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <div className="text-sm text-gray-600">Order ID: {o._id}</div>
                    <div className="font-medium">{o.name || user?.name} — ₹{o.subtotal}</div>
                    <div className="text-sm text-gray-500">{formatDateTime(o.createdAt)}</div>
                  </div>
                  <div className="px-3 py-1 rounded border border-gray-200 text-mehroon">{o.status}</div>
                </div>
                {o.status !== 'cancelled' && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <a href={getWhatsAppHref(supportText)} target="_blank" rel="noreferrer" className={`px-3 py-1 rounded text-white ${isCancelable ? 'bg-red-600' : 'bg-orange-600'}`}>
                      {isCancelable ? 'Cancel order on WhatsApp' : 'Request cancellation on WhatsApp'}
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-semibold">Need help?</h2>
        <div className="bg-white p-4 rounded shadow max-w-xl">
          <p className="text-sm text-gray-600">Send a general enquiry to our team on WhatsApp. Your profile details will be included so we can assist you faster.</p>
          <a href={getWhatsAppHref(buildGeneralEnquiry())} target="_blank" rel="noreferrer" className="inline-block mt-4 px-4 py-2 bg-teal-600 text-white rounded">Contact via WhatsApp</a>
        </div>
      </section>
    </div>
  );
}

export async function getServerSideProps(ctx){
  const session = await getSession(ctx);
  if(!session) return { redirect: { destination: '/login', permanent: false } };
  if(session.user?.role === 'admin') return { redirect: { destination: '/admin', permanent: false } };
  await dbConnect();
  const user = await User.findOne({ email: session.user.email }).lean();
  const orders = await Order.find({ userId: user?._id?.toString() }).sort({ createdAt: -1 }).lean();
  return { props: { user: user ? { id: user._id.toString(), name: user.name, email: user.email, phone: user.phone, address: user.address } : {}, orders: JSON.parse(JSON.stringify(orders)) } };
}
