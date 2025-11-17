import { useState } from 'react';
import Breadcrumbs from '../components/Breadcrumbs';
import { useRouter } from 'next/router';

export default function Contact(){
  const router = useRouter();
  const [form, setForm] = useState({ name:'', email:'', phone:'', address:'', locationUrl:'', subject:'', text:'' });
  const submit = async (e)=>{
    e.preventDefault();
    await fetch('/api/messages', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(form) });
    alert('Message sent');
  }
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Contact</h1>
  <Breadcrumbs />
  <button onClick={() => router.back()} className="mb-4 px-4 py-2 btn-secondary rounded">Back</button>
      <div className="grid md:grid-cols-2 gap-6">
        <form className="bg-white p-4 rounded shadow" onSubmit={submit}>
          <input required placeholder="Name" className="w-full p-2 border mb-2" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} />
          <input required placeholder="Email" className="w-full p-2 border mb-2" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} />
          <input placeholder="Phone" className="w-full p-2 border mb-2" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} />
          <textarea placeholder="Message" className="w-full p-2 border mb-2" value={form.text} onChange={e=>setForm({...form,text:e.target.value})} />
          <button className="px-4 py-2 btn-primary rounded">Send</button>
        </form>
        <div>
          <h3 className="font-semibold">Address</h3>
          <p>New Friends colony, Sector 23, Sanjay Nagar, Ghaziabad, Uttar Pradesh 201002</p>
          <p className="mt-2"><a href="https://maps.app.goo.gl/6qNXoHM1YoV3hQVXA" target="_blank" className="text-mehroon underline">Open map</a></p>
          <div className="mt-3">
            <p className="text-sm">Phone: 9818630972, 8077148123</p>
            <p className="text-sm">Email: <a href="mailto:contact.sdstationary@gmail.com" className="underline">contact.sdstationary@gmail.com</a></p>
          </div>
        </div>
      </div>
    </div>
  )
}
