import dbConnect from '@/lib/mongodb';
import User from '../../models/User';
import { getSession } from 'next-auth/react';

export default async function handler(req, res) {
  await dbConnect();
  const session = await getSession({ req });
  if (!session) return res.status(401).json({ error: 'Not authenticated' });

  const userEmail = session.user.email;
  const user = await User.findOne({ email: userEmail });
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (req.method === 'GET') {
    return res.status(200).json({ email: user.email, name: user.name, phone: user.phone, whatsapp: user.whatsapp, address: user.address, locationUrl: user.locationUrl, role: user.role });
  }

  if (req.method === 'PUT') {
    const { name, phone, whatsapp, address, locationUrl } = req.body;
    if (!name || typeof name !== 'string') return res.status(400).json({ error: 'name required' });
    user.name = name.trim();
    user.phone = (phone || '').trim();
    user.whatsapp = (whatsapp || '').trim();
    user.address = (address || '').trim();
    user.locationUrl = (locationUrl || '').trim();
    await user.save();
    return res.status(200).json({ ok: true, user: { email: user.email, name: user.name, phone: user.phone, whatsapp: user.whatsapp, address: user.address, locationUrl: user.locationUrl } });
  }

  res.status(405).end();
}
