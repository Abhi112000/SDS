import dbConnect from '@/lib/mongodb';
import User from '../../../../models/User';
import bcrypt from 'bcryptjs';

export default async function handler(req,res){
  await dbConnect();
  if(req.method !== 'POST') return res.status(405).end();
  const { token, password } = req.body;
  if(!token || !password) return res.status(400).json({ error: 'token and password required' });
  const user = await User.findOne({ resetToken: token, resetExpires: { $gt: Date.now() } }).exec();
  if(!user) return res.status(400).json({ error: 'invalid or expired token' });
  user.passwordHash = await bcrypt.hash(password, 10);
  user.resetToken = undefined;
  user.resetExpires = undefined;
  await user.save();
  return res.status(200).json({ ok: true });
}
import dbConnect from '@/lib/mongodb';
import User from '../../../models/User';
import { hash } from 'bcryptjs';

export default async function handler(req,res){
  await dbConnect();
  if(req.method !== 'POST') return res.status(405).end();
  const { email, token, password } = req.body;
  const user = await User.findOne({ email, resetToken: token, resetExpires: { $gt: Date.now() } });
  if(!user) return res.status(400).json({ error: 'Invalid or expired' });
  user.passwordHash = await hash(password, 10);
  user.resetToken = undefined; user.resetExpires = undefined;
  await user.save();
  return res.status(200).json({ ok: true });
}
