import { getSession } from 'next-auth/react';
import Breadcrumbs from '../components/Breadcrumbs';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import useSWR, { mutate } from 'swr';
import Pusher from 'pusher-js';
import MessageRenderer from '../components/MessageRenderer';
import { useToast } from '../components/Toast';
import { authRedirect } from '@/lib/authRedirect';

const fetcher = (url) => fetch(url).then(r => r.json());

export default function MessagesPage({ userId }){
  const toast = useToast();
  const router = useRouter();
  const { orderId: orderIdQuery } = router.query || {};
  const apiUrl = '/api/messages?mine=1' + (orderIdQuery ? '&orderId=' + orderIdQuery : '');
  const { data: messages = [] } = useSWR(apiUrl, fetcher, { refreshInterval: 5000 });
  const [active, setActive] = useState(null);
  const [replyLoading, setReplyLoading] = useState(false);
  const [composeLoading, setComposeLoading] = useState(false);
  const [composeSubject, setComposeSubject] = useState('');
  const [composeText, setComposeText] = useState('');

  useEffect(()=>{
    try{
      const p = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY || '', { cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || undefined });
      const ch = p.subscribe(`user-${userId}`);
      ch.bind('message-reply', (data)=>{
        // revalidate list
        mutate(apiUrl);
        toast.push({ message: 'Support replied', type: 'success' });
      });
      ch.bind('new-message', (data)=>{ mutate(apiUrl); toast.push({ message: 'New message from support', type: 'success' }); });
      return ()=>{ ch.unbind(); p.disconnect(); };
    }catch(e){ /* pusher not configured */ }
  },[userId, apiUrl]);

  async function replyTo(id, text){
    if(!text) return;
    setReplyLoading(true);
    try{
      const r = await fetch('/api/messages/reply-user', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, text }) });
      if(!r.ok) throw new Error('send failed');
      mutate(apiUrl);
      localStorage.removeItem(`msg_draft_${id}`);
      setActive(null);
    }catch(e){ toast.push({ message: 'Failed to send reply', type: 'error' }); }
    setReplyLoading(false);
  }

  async function createMessageForOrder(){
    if(!composeText) return;
    setComposeLoading(true);
    try{
      const payload = { subject: composeSubject || `Order: ${orderIdQuery}`, text: composeText, orderId: orderIdQuery };
      const r = await fetch('/api/messages', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if(!r.ok) throw new Error('create failed');
      mutate(apiUrl);
      setComposeText(''); setComposeSubject('');
      toast.push({ message: 'Message sent', type: 'success' });
      // optionally open the created thread in list after refresh
    }catch(e){ toast.push({ message: 'Failed to create message', type: 'error' }); }
    setComposeLoading(false);
  }

  return (
    <div className="p-6">
      <Breadcrumbs items={[{ label: 'Messages' }]} />
      <h1 className="text-2xl font-semibold mb-4">Messages</h1>
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-3">
          {messages.map(m=> (
            <div key={m._id} className="card" onClick={() => setActive(m)}>
              <div className="font-semibold">{m.subject}</div>
              <div className="text-sm text-muted mt-1">{m.text.slice(0,80)}{m.text.length>80?'...':''}</div>
              <div className="text-sm mt-2 text-gray-500">{new Date(m.createdAt).toLocaleString()}</div>
            </div>
          ))}
        </div>
        <div className="md:col-span-2">
          {active ? (
            <div className="card p-4 flex flex-col">
              <div className="font-semibold text-lg">{active.subject}</div>
              <div className="mt-3 space-y-3 max-h-96 overflow-y-auto">
                <div className="p-3 bg-white rounded text-mehroon"><MessageRenderer text={active.text} /></div>
                {groupRepliesByDate(active.replies || []).map(({ date, items }) => (
                  <div key={date} className="mt-2">
                    <div className="text-xs text-gray-400 mb-2">{date}</div>
                    {items.map((r,i) => (
                      <div key={i} className={`p-3 rounded mb-2 ${r.from==='admin'? 'bg-pink-50':'bg-white'}`}>
                        <div className="text-xs text-gray-600 mb-1">{r.from} • {new Date(r.createdAt).toLocaleTimeString()}</div>
                        <MessageRenderer text={r.text} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <div className="mt-3">
                <ReplyBox messageId={active._id} onSend={(txt)=>replyTo(active._id, txt)} loading={replyLoading} />
              </div>
            </div>
          ) : (
            <div className="p-6">
              {orderIdQuery ? (
                <div className="space-y-3">
                  <div className="text-sm text-gray-600">Start a conversation about order <strong>{orderIdQuery}</strong></div>
                  <input value={composeSubject} onChange={e=>setComposeSubject(e.target.value)} placeholder="Subject" className="w-full p-2 border mb-2" />
                  <textarea value={composeText} onChange={e=>setComposeText(e.target.value)} className="w-full p-2 border mb-2 h-40" placeholder="Describe your issue or question about this order" />
                  <div className="flex gap-2">
                    <button onClick={createMessageForOrder} disabled={composeLoading} className="px-4 py-2 btn-primary rounded">{composeLoading? 'Sending...' : 'Send message'}</button>
                    <button onClick={()=>router.replace('/messages')} className="px-4 py-2 border rounded">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="p-6 text-gray-500">Select a message to read and reply.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function groupRepliesByDate(replies){
  const map = {};
  replies.forEach(r => {
    const d = new Date(r.createdAt);
    const key = d.toLocaleDateString();
    if(!map[key]) map[key] = [];
    map[key].push(r);
  });
  return Object.keys(map).sort((a,b)=> new Date(b) - new Date(a)).map(k=>({ date: k, items: map[k] }));
}

function ReplyBox({ messageId, onSend, loading }){
  const [text, setText] = useState('');
  const ref = useRef();
  useEffect(()=>{ const key = `msg_draft_${messageId}`; const saved = localStorage.getItem(key); if(saved) setText(saved); },[messageId]);
  useEffect(()=>{ const key = `msg_draft_${messageId}`; localStorage.setItem(key, text); },[text, messageId]);
  useEffect(()=>{ const el = ref.current; if(!el) return; const handler = (e)=>{ if((e.ctrlKey||e.metaKey) && e.key === 'Enter'){ onSend(text); setText(''); } }; el.addEventListener('keydown', handler); return ()=> el.removeEventListener('keydown', handler); },[text]);
  return (
    <div className="flex gap-2">
      <textarea ref={ref} value={text} onChange={e=>setText(e.target.value)} className="flex-1 p-2 border rounded h-24" placeholder="Write a reply... (Ctrl+Enter to send)" />
      <div className="flex flex-col gap-2">
        <button onClick={()=>{ onSend(text); setText(''); localStorage.removeItem(`msg_draft_${messageId}`); }} disabled={loading} className="px-4 py-2 btn-primary rounded">{loading? 'Sending...' : 'Send'}</button>
      </div>
    </div>
  );
}

export async function getServerSideProps(ctx){
  const session = await getSession(ctx);
  if(!session) return authRedirect(ctx);
  // pass userId for pusher channel
  const user = session.user;
  return { props: { userId: user.id || user.sub || (user?.email || '') } };
}