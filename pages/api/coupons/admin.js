import dbConnect from '@/lib/dbConnect';
import Coupon from '@/models/Coupon';
import { getSession } from 'next-auth/react';
import { getToken } from 'next-auth/jwt';

export default async function handler(req,res){
  await dbConnect();
  // Try normal session first
  const session = await getSession({ req });
  // Fallback: try reading JWT token directly (helps when getSession returns null in some server contexts)
  let token = null;
  try{ token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET }); }catch(e){ /* ignore */ }
  const role = session?.user?.role || token?.role;
  if(!role || role !== 'admin'){
    const payload = { error: 'admin required' };
    if(process.env.NODE_ENV !== 'production') payload.debug = { session: session ? { id: session.user?.id, role: session.user?.role } : null, token: token ? { sub: token.sub, role: token.role } : null };
    return res.status(403).json(payload);
  }

  if(req.method === 'GET'){
    const coupons = await Coupon.find({}).sort({ createdAt:-1 }).lean();
    return res.status(200).json({ ok:true, coupons });
  }

  if(req.method === 'POST'){
    const body = req.body;
    if(body.code) body.code = body.code.toUpperCase();
    const c = await Coupon.create(body);
    return res.status(201).json({ ok:true, coupon: c });
  }

  if(req.method === 'DELETE'){
    const { id } = req.query;
    await Coupon.findByIdAndDelete(id);
    return res.status(204).end();
  }

  res.status(405).end();
}
