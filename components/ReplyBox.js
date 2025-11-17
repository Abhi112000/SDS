import { useState, useEffect, useRef } from 'react';
import MessageRenderer from './MessageRenderer';

export default function ReplyBox({ messageId, onSend, loading }){
  const [text, setText] = useState('');
  const ref = useRef();
  useEffect(()=>{ const key = `msg_draft_${messageId}`; const saved = typeof window !== 'undefined' ? localStorage.getItem(key) : null; if(saved) setText(saved); },[messageId]);
  useEffect(()=>{ const key = `msg_draft_${messageId}`; if(typeof window !== 'undefined') localStorage.setItem(key, text); },[text, messageId]);
  useEffect(()=>{ const el = ref.current; if(!el) return; const handler = (e)=>{ if((e.ctrlKey||e.metaKey) && e.key === 'Enter'){ e.preventDefault(); if(onSend) onSend(text); setText(''); } }; el.addEventListener('keydown', handler); return ()=> el.removeEventListener('keydown', handler); },[text, onSend]);
  return (
    <div>
      <textarea ref={ref} value={text} onChange={e=>setText(e.target.value)} className="w-full p-2 border rounded h-24" placeholder="Write a reply... (Ctrl+Enter to send)" />
      <div className="flex items-center justify-between mt-2">
        <div className="text-xs text-gray-500">Draft saved automatically</div>
        <div>
          <button onClick={()=>{ if(onSend) onSend(text); setText(''); localStorage.removeItem(`msg_draft_${messageId}`); }} disabled={loading} className="px-3 py-1 btn-primary">{loading? 'Sending...' : 'Send'}</button>
        </div>
      </div>
    </div>
  );
}
