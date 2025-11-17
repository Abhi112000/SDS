import { useState } from 'react';

export default function Forgot(){
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  async function submit(){
    const r = await fetch('/api/auth/forgot', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ email }) });
    if(r.ok) setSent(true);
  }
  return (
    <div className="p-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-4">Forgot Password</h1>
      {!sent ? (
        <div className="bg-white p-4 rounded">
          <input className="w-full p-2 border mb-3" value={email} onChange={e=>setEmail(e.target.value)} placeholder="your email" />
          <button className="px-4 py-2 btn-primary rounded" onClick={submit}>Send reset link</button>
        </div>
      ) : (
        <div className="bg-white p-4 rounded text-mehroon">If that email exists a reset link was sent (or logged).</div>
      )}
    </div>
  )
}
