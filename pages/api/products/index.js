import dbConnect from '@/lib/mongodb';
import Product from '../../../models/Product';
import Inventory from '@/models/Inventory';
import { getToken } from 'next-auth/jwt';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';

export default async function handler(req,res){
  await dbConnect();
  if(req.method === 'GET'){
    const products = await Product.find({}).lean();
    return res.status(200).json(products);
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
    // Server-side enforcement for sale tags and saleHistory on create
    const body = { ...req.body };
    body.price = typeof body.price === 'string' ? Number(body.price) : body.price;
    body.originalPrice = body.originalPrice !== undefined ? (typeof body.originalPrice === 'string' ? Number(body.originalPrice) : body.originalPrice) : body.originalPrice;
    if(body.onSale){
      body.tags = Array.from(new Set([...(body.tags || []), 'SALE!']));
      const histPrice = body.salePrice !== undefined ? (typeof body.salePrice === 'string' ? Number(body.salePrice) : body.salePrice) : body.price;
      body.saleHistory = Array.isArray(body.saleHistory) && body.saleHistory.length ? body.saleHistory : [{ price: Number(histPrice || 0), startAt: new Date().toISOString(), active: true }];
    }
    const p = await Product.create(body);
    try{
      // ensure an Inventory record exists for search and sales mapping
      const existing = await Inventory.findOne({ $or: [ { sku: p.sku }, { name: p.title } ] }).lean();
      if(!existing){
        // create minimal inventory record
        const invDoc = await Inventory.create({
          sku: p.sku,
          name: p.title,
          category: p.category || '',
          sellingPrice: p.price != null ? require('mongoose').Types.Decimal128.fromString(Number(p.price || 0).toFixed(2)) : require('mongoose').Types.Decimal128.fromString('0'),
          costPrice: require('mongoose').Types.Decimal128.fromString('0'),
          stock: p.stock || 0,
          minStockLevel: 0
        });
      }
    }catch(e){ console.warn('ensure inventory failed', e && e.message); }
    return res.status(201).json(p);
  }

  if(req.method === 'PUT'){
    const { id } = req.query;
    const incoming = { ...req.body };
    // load existing product to compute sale transitions
    const existing = await Product.findById(id).lean();
    if(!existing) return res.status(404).json({ error: 'not found' });

    const update = { ...incoming };
    // normalize numeric fields if present
    if(update.price !== undefined) update.price = typeof update.price === 'string' ? Number(update.price) : update.price;
    if(update.originalPrice !== undefined) update.originalPrice = typeof update.originalPrice === 'string' ? Number(update.originalPrice) : update.originalPrice;
    if(update.salePrice !== undefined) update.salePrice = typeof update.salePrice === 'string' ? Number(update.salePrice) : update.salePrice;

    const now = new Date().toISOString();
    // Sale started
    if(update.onSale === true && !existing.onSale){
      update.tags = Array.from(new Set([...(existing.tags || []), 'SALE!']));
      const histPrice = update.salePrice !== undefined ? update.salePrice : (existing.salePrice !== undefined ? existing.salePrice : (update.price !== undefined ? update.price : existing.price));
      const history = Array.isArray(existing.saleHistory) ? [...existing.saleHistory] : [];
      history.push({ price: Number(histPrice || 0), startAt: now, active: true });
      update.saleHistory = history;
    }
    // Sale stopped
    if(update.onSale === false && existing.onSale){
      // remove SALE! tag
      update.tags = (existing.tags || []).filter(t => t !== 'SALE!');
      // mark last active history entry inactive
      const history = Array.isArray(existing.saleHistory) ? existing.saleHistory.map((h,i)=> i===existing.saleHistory.length-1 ? ({ ...h, endAt: now, active: false }) : h) : [];
      update.saleHistory = history;
    }
    // If salePrice updated while sale is active, update last active history price
    if(update.salePrice !== undefined && existing.onSale){
      const history = Array.isArray(existing.saleHistory) ? [...existing.saleHistory] : [];
      const lastIdx = history.map(h=>h.active?1:0).lastIndexOf(1);
      const idx = lastIdx === -1 ? history.length-1 : lastIdx;
      if(history[idx]){ history[idx].price = Number(update.salePrice); }
      update.saleHistory = history;
    }

    const updated = await Product.findByIdAndUpdate(id, update, { new: true });
    return res.status(200).json(updated);
  }

  if(req.method === 'DELETE'){
    const { id } = req.query;
    await Product.findByIdAndDelete(id);
    return res.status(204).end();
  }

  res.status(405).end();
}
