import dbConnect from '@/lib/mongodb';
import Category from '@/models/Category';
import { getSession } from 'next-auth/react';
import { getToken } from 'next-auth/jwt';

export default async function handler(req, res){
  await dbConnect();
  if(req.method === 'GET'){
    const cats = await Category.find({}).sort({ parentId: 1, name: 1 }).lean();
    return res.status(200).json(cats);
  }

  const session = await getSession({ req });
  let token = null;
  try{ token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET }); }catch(e){}
  const role = session?.user?.role || token?.role;
  if(!role || role !== 'admin') return res.status(403).json({ error: 'admin required' });

  if(req.method === 'POST'){
    try{
      const { name, parentId } = req.body || {};
      const trimmedName = String(name || '').trim();
      if(!trimmedName) return res.status(400).json({ error: 'name required' });

      const parent = parentId ? await Category.findById(parentId).lean() : null;
      if(parentId && !parent) return res.status(400).json({ error: 'Parent category not found' });

      const exists = await Category.findOne({ parentId: parent ? parent._id : null, name: trimmedName });
      if(exists) return res.status(409).json({ error: 'Category exists' });

      const c = await Category.create({ name: trimmedName, parentId: parent ? parent._id : null });
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
      if(!id) return res.status(400).json({ error: 'id required' });
      const deleted = await Category.findByIdAndDelete(id);
      if(!deleted) return res.status(404).json({ error: 'Category not found' });
      await Category.deleteMany({ parentId: deleted._id });
      return res.status(200).json({ ok: true, deleted });
    }catch(e){ return res.status(500).json({ error: e.message || 'delete failed' }); }
  }

  res.status(405).end();
}
