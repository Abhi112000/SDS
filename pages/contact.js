import Link from 'next/link';
import { useState } from 'react';
import { useToast } from '@/components/Toast';
import Breadcrumbs from '../components/Breadcrumbs';
import { useRouter } from 'next/router';

export default function Contact(){
  const router = useRouter();
  const [form, setForm] = useState({ name:'', email:'', phone:'', address:'', locationUrl:'', subject:'', text:'' });
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const toast = useToast();
  const submit = async (e)=>{
    e.preventDefault();
    setSending(true);
    try {
      const response = await fetch('/api/messages', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ ...form, type: 'contact', subject: form.subject || 'Website contact enquiry' }) });
      const result = await response.json().catch(() => ({}));
      if(!response.ok) throw new Error(result.error || 'Message could not be sent');
      setSent(true);
      toast?.push?.({ message: 'Message sent successfully', type: 'success' });
      setForm({ name:'', email:'', phone:'', address:'', locationUrl:'', subject:'', text:'' });
    } catch(error) {
      toast?.push?.({ message: error.message, type: 'error' });
    } finally { setSending(false); }
  }
  return (
    <div className="contact-page-shell">
      <Breadcrumbs />
      <div className="contact-header">
        <div>
          <div className="page-section-kicker">Support</div>
          <h1 className="contact-page-title">Contact Us</h1>
        </div>
        <button onClick={() => router.back()} className="contact-back-button">Back</button>
      </div>
      <div className="contact-layout">
        <form className="contact-form-panel contact-form-panel--active" onSubmit={submit}>
          {sent && <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800" role="status">Thank you for reaching out. Our team has received your message and will contact you shortly.</div>}
          <div className="contact-form-head">
            <h2 className="contact-form-title">Send a message</h2>
            <p className="contact-form-subtitle">We usually reply during store hours.</p>
          </div>
          <div className="contact-grid">
            <label className="block">
              <span className="contact-field-label">Name</span>
              <input required placeholder="Name" className="form-field mt-2" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} />
            </label>
            <label className="block">
              <span className="contact-field-label">Email</span>
              <input required type="email" placeholder="Email" className="form-field mt-2" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} />
            </label>
          </div>
          <label className="block mt-4">
            <span className="contact-field-label">Phone</span>
            <input placeholder="Phone" className="form-field mt-2" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} />
          </label>
          <label className="block mt-4">
            <span className="contact-field-label">Address (optional)</span>
            <input placeholder="Address" className="form-field mt-2" value={form.address} onChange={e=>setForm({...form,address:e.target.value})} />
          </label>
          <label className="block mt-4">
            <span className="contact-field-label">Message</span>
            <textarea placeholder="How can we help?" className="form-field mt-2 min-h-[130px] resize-y" value={form.text} onChange={e=>setForm({...form,text:e.target.value})} />
          </label>
          <div className="contact-action-row">
            <button disabled={sending} className="contact-submit-button disabled:opacity-60">{sending ? 'Sending...' : 'Send message'}</button>
            <Link href="/shop" className="contact-browse-button">Browse Products</Link>
          </div>
        </form>
        <aside className="contact-store-panel">
          <div className="contact-store-head">
            <span className="contact-icon-badge">
              <svg xmlns="http://www.w3.org/2000/svg" className="contact-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0Z"/><circle cx="12" cy="10" r="3"/></svg>
            </span>
            <div>
              <h3 className="contact-store-title">Visit Shree Durga</h3>
              <div className="contact-store-subtitle">Stationery Store</div>
            </div>
          </div>
          <div className="contact-map-preview">
            <div className="contact-map-preview-grid"></div>
            <span className="contact-map-pin">●</span>
            <span className="contact-map-label">Shree Durga Stationery</span>
          </div>
          <div className="contact-store-details">
            <div>
              <div className="contact-detail-label">Address</div>
              <p className="contact-detail-copy">New Friends colony, Sector 23, Sanjay Nagar, Ghaziabad, Uttar Pradesh 201002</p>
            </div>
            <div>
              <div className="contact-detail-label">Phone</div>
              <p className="contact-detail-copy">9818630972, 8077148123</p>
            </div>
            <div>
              <div className="contact-detail-label">Email</div>
              <p className="contact-detail-copy"><a href="mailto:contact.sdstationary@gmail.com" className="underline">contact.sdstationary@gmail.com</a></p>
            </div>
            <a href="https://maps.app.goo.gl/6qNXoHM1YoV3hQVXA" target="_blank" className="contact-map-button">Open map</a>
          </div>
        </aside>
      </div>
    </div>
  )
}
