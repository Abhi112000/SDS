import dbConnect from '@/lib/mongodb';
import User from '../../../models/User';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import rateLimit from '@/lib/rateLimit';

const limiter = rateLimit({ points: 5, windowSeconds: 60 });

export default async function handler(req,res){
  const key = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'local') + '::' + (req.body?.email||'');
  const allowed = await limiter(key);
  if(!allowed) return res.status(429).json({ error: 'too many requests' });
  await dbConnect();
  if(req.method !== 'POST') return res.status(405).end();
  const { email } = req.body;
  if(!email || typeof email !== 'string') return res.status(400).json({ error: 'email required' });
  const emailTrim = email.trim();
  // simple email regex
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailTrim)) return res.status(400).json({ error: 'invalid email' });
  const user = await User.findOne({ email: emailTrim }).exec();
  if(!user) return res.status(200).json({ ok: true }); // don't reveal existence
  // prevent token flood: if a valid token exists and not expired, return ok
  if(user.resetToken && user.resetExpires && user.resetExpires > Date.now() - 1000*60) return res.status(200).json({ ok: true });
  const token = crypto.randomBytes(20).toString('hex');
  user.resetToken = token;
  user.resetExpires = Date.now() + 1000 * 60 * 60; // 1 hour
  await user.save();

  const resetUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/auth/reset?token=${token}`;

  if(process.env.SMTP_HOST && process.env.SMTP_USER){
    try{
      const transport = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT||587), secure: false, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
      const html = `<p>Hi ${user.name || ''},</p><p>Click the link below to reset your password (valid for 1 hour):</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you didn't request this, ignore.</p>`;
      await transport.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to: user.email, subject: 'Password reset', text: `Reset your password: ${resetUrl}`, html });
      return res.status(200).json({ ok: true });
    }catch(e){ console.warn('smtp send failed', e?.message || e); }
  }

  console.log('Password reset link for', user.email, resetUrl);
  return res.status(200).json({ ok: true });
}
