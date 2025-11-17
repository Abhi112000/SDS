import { getSession } from 'next-auth/react';
import dbConnect from '@/lib/mongodb';
import Order from '@/models/Order';
import User from '@/models/User';
import Message from '@/models/Message';
import { useEffect, useState } from 'react';
import Pusher from 'pusher-js';
import { useToast } from '../components/Toast';
import { useCallback } from 'react';
import Breadcrumbs from '../components/Breadcrumbs';
import { useRouter } from 'next/router';

export default function Dashboard({ user, orders, messages: initialMessages }) {
  const router = useRouter();
  const [orderList, setOrderList] = useState(orders || []);
  const toast = useToast();
  const [messages, setMessages] = useState(initialMessages || []);
  const [activeMsg, setActiveMsg] = useState(null);

  useEffect(() => {
    if (!user?.id) return;
    // subscribe to pusher channel for this user
    try {
      const p = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY || '', { cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || '' });
      const channel = p.subscribe(`user-${user.id}`);
      channel.bind('order-status-updated', (data) => {
        setOrderList((prev) => prev.map(o => (o._id === data.orderId ? { ...o, status: data.status } : o)));
      });
      channel.bind('message-reply', (data) => {
        toast.push({ message: `Support replied: ${data.text}`, type: 'success' });
        // if active message matches, append reply
        setMessages(prev => prev.map(m => m._id === data.messageId ? { ...m, replies: [...(m.replies||[]), { from: 'admin', text: data.text, createdAt: new Date() }] } : m));
        if(activeMsg && activeMsg._id === data.messageId){
          setActiveMsg(prev => ({ ...prev, replies: [...(prev.replies||[]), { from: 'admin', text: data.text, createdAt: new Date() }] }));
        }
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
          {orderList.map(o => (
            <div key={o._id} className="bg-white p-3 rounded shadow">
              <div className="flex justify-between">
                <div>
                  <div className="text-sm text-gray-600">Order ID: {o._id}</div>
                  <div className="font-medium">{o.name} — ₹{o.subtotal}</div>
                  <div className="text-sm text-gray-500">{new Date(o.createdAt).toLocaleString()}</div>
                </div>
                <div className="px-3 py-1 rounded border border-gray-200 text-mehroon">{o.status}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-semibold">Messages</h2>
        <div className="space-y-3 mt-3">
          {messages.length===0 && <div className="text-sm text-gray-500">You have no support messages.</div>}
          {messages.map(m=> (
            <div key={m._id} className={`bg-white p-3 rounded shadow ${m.read? 'opacity-70':''}`}>
              <div className="flex justify-between">
                <div>
                  <div className="font-medium">{m.subject}</div>
                  <div className="text-sm text-gray-500">{m.text.slice(0,120)}{m.text.length>120?'...':''}</div>
                </div>
                <div>
                  <button onClick={async()=>{
                    try{
                      await fetch('/api/messages/read?id='+m._id, { method: 'POST' });
                      setActiveMsg(m);
                    }catch(e){ toast.push({ message: 'Unable to open message', type: 'error' }); }
                  }} className="px-2 py-1 btn-primary rounded">Open</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* message thread modal */}
      {activeMsg && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white max-w-2xl w-full p-4 rounded">
            <div className="flex justify-between items-center">
              <div>
                <div className="font-semibold">{activeMsg.subject}</div>
                <div className="text-sm text-gray-500">From: {activeMsg.fromName || activeMsg.fromEmail}</div>
              </div>
              <div>
                <button onClick={()=>setActiveMsg(null)} className="px-2 py-1 bg-gray-200 rounded">Close</button>
              </div>
            </div>
            <div className="mt-4 space-y-3 max-h-80 overflow-y-auto">
              <div className="p-3 bg-white rounded text-mehroon">{activeMsg.text}</div>
              {(activeMsg.replies||[]).map((r,i)=> (
                <div key={i} className="p-3 rounded bg-white">
                  <div className="text-sm text-gray-600">{r.from} • {new Date(r.createdAt).toLocaleString()}</div>
                  <div className="mt-1 text-mehroon">{r.text}</div>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium mb-2">Reply</label>
              <div className="flex gap-2">
                <textarea id="user-reply" className="flex-1 p-2 border rounded" placeholder="Write a reply to support..."></textarea>
                <button onClick={async()=>{
                  const el = document.getElementById('user-reply');
                  const text = el.value.trim();
                  if(!text) return;
                  // optimistic UI
                  setActiveMsg(prev => ({ ...prev, replies: [...(prev.replies||[]), { from: 'you', text, createdAt: new Date() }] }));
                  setMessages(prev => prev.map(m => m._id === activeMsg._id ? { ...m, replies: [...(m.replies||[]), { from: 'you', text, createdAt: new Date() }] } : m));
                  el.value = '';
                  try{
                    const r = await fetch('/api/messages/reply-user', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: activeMsg._id, text }) });
                    if(!r.ok) throw new Error('send failed');
                    // server returns updated message - update UI
                    const data = await r.json();
                    const updated = data.msg;
                    setActiveMsg(updated);
                    setMessages(prev => prev.map(m => m._id === updated._id ? updated : m));
                  }catch(e){
                    toast.push({ message: 'Failed to send reply', type: 'error' });
                  }
                }} className="px-4 py-2 btn-primary rounded">Send</button>
              </div>
            </div>
          </div>
        </div>
      )}
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
  const q = { $or: [] };
  if(user?._id) q.$or.push({ fromUserId: user._id.toString() });
  if(user?.email) q.$or.push({ fromEmail: user.email });
  const messages = await Message.find(q.$or.length ? q : {}).sort({ createdAt: -1 }).lean();
  return { props: { user: user ? { id: user._id.toString(), name: user.name, email: user.email, phone: user.phone, address: user.address } : {}, orders: JSON.parse(JSON.stringify(orders)), messages: JSON.parse(JSON.stringify(messages)) } };
}
