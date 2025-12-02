import dbConnect from '@/lib/mongodb';
import Product from '../../../models/Product';
import { getToken } from 'next-auth/jwt';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';

export default async function handler(req,res){
  await dbConnect();
  if(req.method === 'GET'){
    // support pagination and basic filters for listing
    const { page = '1', limit = '24', q, category } = req.query || {};
    const PAGE = Math.max(1, parseInt(page, 10) || 1);
    const LIMIT = Math.max(1, Math.min(200, parseInt(limit, 10) || 24));
    const filter = {};
    if(category) filter.category = category;
    if(q) filter.title = { $regex: q, $options: 'i' };

    const [products, total] = await Promise.all([
      Product.find(filter)
        .sort({ title: 1 })
        .skip((PAGE - 1) * LIMIT)
        .limit(LIMIT)
        .select('title price sku category image')
        .lean(),
      Product.countDocuments(filter)
    ]);

    return res.status(200).json({ products, total, page: PAGE, limit: LIMIT });
  }

  // Protected admin actions
  // Debug: log cookies and session to help diagnose client/session issues
  try{
    if(process.env.NODE_ENV !== 'production'){
      console.log('POST /api/products - cookies:', req.headers.cookie);
    }
  }catch(e){}

  // Use getServerSession for server-side session detection; fallback to getToken if needed
  let session = null;
  try{
    session = await getServerSession(req, res, authOptions);
    if(process.env.NODE_ENV !== 'production'){
      console.log('POST /api/products - session:', session && { id: session.user?.id, role: session.user?.role });
    }
  }catch(e){ if(process.env.NODE_ENV !== 'production') console.warn('getServerSession failed', e && e.message); }

  // Fallback: try to read JWT token directly if getSession didn't return session
  let token = null;
  try{
    token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if(process.env.NODE_ENV !== 'production') console.log('POST /api/products - jwt token:', token && { sub: token.sub, role: token.role });
  }catch(e){ if(process.env.NODE_ENV !== 'production') console.log('getToken error', e && e.message); }

  const role = session?.user?.role || token?.role;
  const userId = session?.user?.id || token?.sub;
  if(!role || role !== 'admin'){
    const payload = { error: 'admin required' };
    if(process.env.NODE_ENV !== 'production'){
      payload.debug = { session: session ? { id: session.user?.id, role: session.user?.role } : null, token: token ? { sub: token.sub, role: token.role } : null };
    }
    return res.status(403).json(payload);
  }

  if(req.method === 'POST'){
    const p = await Product.create(req.body);
    return res.status(201).json(p);
  }

  if(req.method === 'PUT'){
    const { id } = req.query;
    const updated = await Product.findByIdAndUpdate(id, req.body, { new: true });
    return res.status(200).json(updated);
  }

  if(req.method === 'DELETE'){
    const { id } = req.query;
    await Product.findByIdAndDelete(id);
    return res.status(204).end();
  }

  res.status(405).end();
}
