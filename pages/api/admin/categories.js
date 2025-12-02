import dbConnect from '@/lib/mongodb';
import Category from '@/models/Category';
import { getSession } from 'next-auth/react';
import { getToken } from 'next-auth/jwt';

export default async function handler(req, res){
  await dbConnect();
  // Public GET: list categories
  if(req.method === 'GET'){
    const cats = await Category.find({}).sort({ name: 1 }).lean();
    return res.status(200).json(cats);
  }

  // protected admin actions
  const session = await getSession({ req });
  let token = null;
  try{ token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET }); }catch(e){}
  const role = session?.user?.role || token?.role;
  if(!role || role !== 'admin') return res.status(403).json({ error: 'admin required' });

  if(req.method === 'POST'){
    try{
      const { name } = req.body;
      if(!name) return res.status(400).json({ error: 'name required' });
      const exists = await Category.findOne({ name: name.trim() });
      if(exists) return res.status(409).json({ error: 'Category exists' });
      const c = await Category.create({ name: name.trim() });
      return res.status(201).json(c);
    }catch(e){ return res.status(500).json({ error: e.message || 'create failed' }); }
  }

  if(req.method === 'PUT'){
    try{
      const { id } = req.query;
      const updated = await Category.findByIdAndUpdate(id, req.body, { new: true });
      return res.status(200).json(updated);
    }catch(e){ return res.status(500).json({ error: e.message || 'update failed' }); }
  }

  if(req.method === 'DELETE'){
    try{
      const { id } = req.query;
      await Category.findByIdAndDelete(id);
      return res.status(204).end();
    }catch(e){ return res.status(500).json({ error: e.message || 'delete failed' }); }
  }

  res.status(405).end();
}
