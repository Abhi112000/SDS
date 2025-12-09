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
    await fetch('/api/messages/read?id='+id, { method: 'POST' });
    mutate();
  }

  async function replyTo(id, text){
    if(!text) return;
    setReplyLoading(l=>({ ...l, [id]: true }));
    try{
  const r = await fetch('/api/messages/reply', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, text }) });
  if(!r.ok){ const err = await r.json().catch(()=>({ error: 'unknown' })); console.error('reply failed', r.status, err); toast?.push?.({ message: 'Reply failed: '+(err.error||err.message||r.status), type: 'error' }); }
  else { mutate(); document.getElementById(`reply-${id}`).value = ''; }
    }catch(e){ console.error(e); }
    setReplyLoading(l=>({ ...l, [id]: false }));
  }

  if(status === 'loading') return <div className="p-6">Loading session...</div>;
  if(!session || session.user?.role !== 'admin') return <div className="p-6">Unauthorized</div>;

  return (
    <div className="p-6">
      <div className="grid md:grid-cols-4 gap-6">
        <AdminSidebar />
        <main className="md:col-span-3">
          <h1 className="text-2xl font-bold mb-4">Messages</h1>
          <div className="space-y-3">
            {messages.map(m=> (
          <div key={m._id} className={`card ${m.read? 'opacity-60':''}`}>
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
