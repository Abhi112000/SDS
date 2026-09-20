import { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';

export default function FeedbackModal({ open, onClose }){
  const [mounted, setMounted] = useState(false);
  useEffect(()=>{ setMounted(true); }, []);
  const [name, setName] = useState('');
  const [type, setType] = useState('feedback');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  if(!mounted) return null;
  if(!open) return null;

  async function handleSubmit(e){
    e.preventDefault();
    setLoading(true);
    try{
      await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, message, type })
      });
      setSuccess(true);
      setTimeout(()=>{ setSuccess(false); onClose(); }, 1200);
    }catch(e){
      console.error(e);
    }finally{ setLoading(false); }
  }

  return ReactDOM.createPortal(
    <div className="modal-overlay">
      <div className="absolute inset-0" onClick={onClose} />
      <div role="dialog" aria-modal="true" onClick={(e)=>e.stopPropagation()} className="modal-panel compact-gap z-10">
        <h3 className="text-lg font-semibold mb-3">Feedback & Requests</h3>
        {success ? (
          <div className="text-green-600">Thanks — your message was sent.</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-sm font-medium">Type</label>
              <select value={type} onChange={e=>setType(e.target.value)} className="w-full p-2 border">
                <option value="feedback">Feedback</option>
                <option value="suggestion-request">Suggestion request</option>
                <option value="support">Support request</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium">Name</label>
              <input value={name} onChange={e=>setName(e.target.value)} required className="form-field w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium">Email</label>
              <input value={email} onChange={e=>setEmail(e.target.value)} type="email" className="form-field w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium">Phone</label>
              <input value={phone} onChange={e=>setPhone(e.target.value)} className="form-field w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium">Message</label>
              <textarea value={message} onChange={e=>setMessage(e.target.value)} required className="form-field w-full h-24" />
            </div>
            <div className="flex items-center justify-end gap-2">
              <button type="button" onClick={onClose} className="px-3 py-2 rounded bg-gray-100">Cancel</button>
              <button type="submit" disabled={loading} className="px-4 py-2 rounded btn-primary text-white">{loading ? 'Sending...' : 'Send'}</button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}
