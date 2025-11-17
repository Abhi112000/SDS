import { useState } from 'react';
import { useRouter } from 'next/router';

export default function Reset(){
  const router = useRouter();
  const [token, setToken] = useState(router.query.token || '');
  const [password, setPassword] = useState('');
  const [ok, setOk] = useState(false);
  async function submit(){
    const r = await fetch('/api/auth/reset', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ token, password }) });
    if(r.ok) setOk(true);
  }
  return (
    <div className="p-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-4">Reset Password</h1>
      {ok ? <div className="bg-white p-4 rounded text-mehroon">Password updated. You can now <a href="/login" className="text-mehroon underline">login</a>.</div> : (
        <div className="bg-white p-4 rounded">
          <input className="w-full p-2 border mb-3" value={token} onChange={e=>setToken(e.target.value)} placeholder="reset token" />
          <input type="password" className="w-full p-2 border mb-3" value={password} onChange={e=>setPassword(e.target.value)} placeholder="new password" />
          <button className="px-4 py-2 btn-primary rounded" onClick={submit}>Set password</button>
        </div>
      )}
    </div>
  )
}
