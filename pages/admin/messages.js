import useSWR from 'swr';
import { getSession, useSession } from 'next-auth/react';
import { useState } from 'react';
import { useToast } from '@/components/Toast';
import MessageRenderer from '../../components/MessageRenderer';
import ReplyBox from '../../components/ReplyBox';
import AdminSidebar from '@/components/AdminSidebar';

const fetcher = url => fetch(url, { credentials: 'include' }).then(r => r.json());

export default function AdminMessages(){
  const { data: session, status } = useSession();
  const { data: messages = [], mutate } = useSWR('/api/messages', fetcher);
  const [replyLoading, setReplyLoading] = useState({});
  const toast = useToast();

  async function markRead(id){
    if(!id) return;
    try{
      const res = await fetch('/api/messages/read?id='+id, { method: 'POST', credentials: 'include' });
      if(!res.ok){
        const err = await res.json().catch(()=>({ error: 'Unknown error' }));
        toast?.push?.({ message: 'Unable to mark read: ' + (err.error || err.message || res.status), type: 'error' });
      } else {
        toast?.push?.({ message: 'Message marked read', type: 'success' });
        mutate();
      }
    }catch(e){
      toast?.push?.({ message: 'Unable to mark read: ' + (e.message || 'unknown'), type: 'error' });
    }
  }

  async function replyTo(id, text){
    if(!text) return;
    setReplyLoading(l=>({ ...l, [id]: true }));
    try{
      const r = await fetch('/api/messages/reply', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, text }) });
      if(!r.ok){
        const err = await r.json().catch(()=>({ error: 'unknown' }));
        console.error('reply failed', r.status, err);
        toast?.push?.({ message: 'Reply failed: '+(err.error||err.message||r.status), type: 'error' });
      } else {
        toast?.push?.({ message: 'Reply sent', type: 'success' });
        mutate();
      }
    }catch(e){
      console.error(e);
      toast?.push?.({ message: 'Reply failed: ' + (e.message || 'unknown'), type: 'error' });
    }
    setReplyLoading(l=>({ ...l, [id]: false }));
  }

  if(status === 'loading') return <div className="p-6">Loading session...</div>;
  if(!session || session.user?.role !== 'admin') return <div className="p-6">Unauthorized</div>;

  return (
    <div className="p-6">
      <div className="grid md:grid-cols-4 gap-6">
        <AdminSidebar />
        <main className="md:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold">Messages</h1>
            <div className="text-sm text-gray-600">Total: {messages.length}</div>
          </div>
          <div className="space-y-3">
            {messages.length === 0 && <div className="text-sm text-gray-500">No messages found.</div>}
            {messages.map(m=> (
          <div key={m._id} className={`card ${m.read? 'opacity-70' : 'border-l-4 border-blue-500'}`}>
            <div className="flex justify-between">
              <div>
          <div className="font-medium">{m.subject}{m.orderId ? <span className="ml-2 text-xs text-gray-500">(Order: {m.orderId})</span> : null}</div>
          <div className="text-sm text-gray-500">From: {m.fromName} • {m.fromEmail}</div>
              </div>
              <div>
                {!m.read && <button onClick={()=>markRead(m._id)} className="px-2 py-1 btn-primary">Mark read</button>}
              </div>
            </div>
            <div className="mt-2 text-sm"><MessageRenderer text={m.text} /></div>
        {m.orderId && <div className="mt-2"><a href={`/admin/orders/${m.orderId}`} className="text-sm text-blue-600">View order</a> <a href={`/messages?orderId=${m.orderId}`} className="ml-2 text-sm text-blue-600">Open chat</a></div>}
            <div className="mt-3">
              <div className="text-sm font-semibold">Replies</div>
              <div className="space-y-2 mt-2">
                {(m.replies||[]).map((r,i)=> (
                  <div key={i} className="text-sm p-2" style={{ background: 'rgba(255,228,236,0.45)', borderRadius: 8 }}>
                    <div className="text-xs text-gray-600">{r.from} • {r.createdAt ? new Date(r.createdAt).toLocaleString() : ''}</div>
                    <MessageRenderer text={r.text} />
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-3">
              <ReplyBox messageId={m._id} onSend={(txt)=>{ replyTo(m._id, txt); }} loading={!!replyLoading[m._id]} />
            </div>
          </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}

export async function getServerSideProps(ctx){
  const session = await getSession(ctx);
  if(!session || session.user.role !== 'admin') return { redirect: { destination: '/login', permanent: false } };
  return { props: {} };
}
