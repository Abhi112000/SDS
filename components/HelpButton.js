import { useState } from 'react';
import { useToast } from './Toast';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';

export default function HelpButton(){
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ subject: '', text: '', name: '', email: '', phone: '' });
  const toast = useToast();
  const { data: session } = useSession();
  const router = useRouter();

  async function submit(){
    const res = await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const j = await res.json().catch(()=>({}));
    if(res.ok){ toast.push({ message: 'Message sent. Support will contact you shortly.' }); setOpen(false); setForm({ subject: '', text: '', name: '', email: '', phone: '' }); }
    else toast.push({ message: 'Failed to send message: ' + (j.error||'unknown'), type: 'error' });
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <button onClick={()=>{ if(session) router.push('/messages'); else setOpen(true); }} className="flex items-center gap-2 px-4 py-2 rounded-full shadow-sm" style={{ background: 'linear-gradient(90deg,var(--brand-1),var(--brand-2))', color: '#063244' }}>
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M2 5a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H9l-5 3V5z" /></svg>
        Help
      </button>

  {!session && open && (
        <div className="fixed inset-0 bg-black/30 flex items-end md:items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 shadow-lg w-full max-w-md m-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-semibold">Contact Support</h3>
              <button onClick={()=>setOpen(false)} className="text-gray-400">Close</button>
            </div>
            <div className="space-y-3">
              <input placeholder="Subject" value={form.subject} onChange={e=>setForm({...form, subject: e.target.value})} className="w-full p-3 border rounded" />
              <textarea placeholder="Your message" value={form.text} onChange={e=>setForm({...form, text: e.target.value})} className="w-full p-3 border rounded h-28" />
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="Name" value={form.name} onChange={e=>setForm({...form, name: e.target.value})} className="w-full p-3 border rounded" />
                <input placeholder="Email" value={form.email} onChange={e=>setForm({...form, email: e.target.value})} className="w-full p-3 border rounded" />
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={()=>setOpen(false)} className="px-4 py-2 rounded bg-gray-100">Cancel</button>
                <button onClick={submit} className="px-4 py-2 rounded btn-primary">Send</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
