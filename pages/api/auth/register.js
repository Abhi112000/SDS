import dbConnect from '@/lib/mongodb';
import User from '../../../models/User';
import { hash } from 'bcryptjs';

export default async function handler(req, res){
  await dbConnect();
  if(req.method === 'POST'){
    const { name, email, password, phone, address, locationUrl } = req.body;
    if(!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const existing = await User.findOne({ email });
    if(existing) return res.status(400).json({ error: 'User exists' });
    const passwordHash = await hash(password, 10);
    const user = await User.create({ name, email, passwordHash, phone, address, locationUrl });
    return res.status(201).json({ ok: true });
  }
  if(req.method === 'PUT'){
    const { email, name, phone, address, locationUrl } = req.body;
    const user = await User.findOneAndUpdate({ email }, { name, phone, address, locationUrl }, { new: true });
    return res.status(200).json({ ok: true, user });
  }
  res.status(405).end();
}
