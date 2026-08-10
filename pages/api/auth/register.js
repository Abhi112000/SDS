import dbConnect from '@/lib/mongodb';
import User from '../../../models/User';
import { hash } from 'bcryptjs';

const normalizePhone = (value) => String(value || '').replace(/[^0-9+]/g, '');
const isValidWhatsApp = (value) => {
  const normalized = normalizePhone(value).replace(/^\+/, '');
  return /^[0-9]{8,15}$/.test(normalized);
};

export default async function handler(req, res){
  await dbConnect();
  if(req.method === 'POST'){
    const { name, email, password, phone, whatsapp, address, locationUrl } = req.body;
    if(!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const existing = await User.findOne({ email });
    if(existing) return res.status(400).json({ error: 'User exists' });
    const normalizedPhone = normalizePhone(phone);
    const normalizedWhatsApp = normalizePhone(whatsapp);
    if (normalizedWhatsApp && !isValidWhatsApp(normalizedWhatsApp)) {
      return res.status(400).json({ error: 'Invalid WhatsApp number' });
    }
    const passwordHash = await hash(password, 10);
    const user = await User.create({ name, email, passwordHash, phone: normalizedPhone, whatsapp: normalizedWhatsApp, address, locationUrl });
    return res.status(201).json({ ok: true });
  }
  if(req.method === 'PUT'){
    const { email, name, phone, address, locationUrl } = req.body;
    const user = await User.findOneAndUpdate({ email }, { name, phone, address, locationUrl }, { new: true });
    return res.status(200).json({ ok: true, user });
  }
  res.status(405).end();
}
