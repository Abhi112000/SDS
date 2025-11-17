import { getSession } from 'next-auth/react';
import dbConnect from '@/lib/mongodb';
import crypto from 'crypto';

export const config = {
  api: {
    bodyParser: { sizeLimit: '10mb' }, // allow base64 uploads up to ~10MB
  },
};

export default async function handler(req, res){
  // only allow POST and admin users
  if(req.method !== 'POST') return res.status(405).end();

  // require auth (session cookie)
  const session = await getSession({ req });
  if(!session || session.user?.role !== 'admin') return res.status(403).json({ error: 'admin required' });

  const { dataUrl, uploadPreset, folder } = req.body || {};
  if(!dataUrl) return res.status(400).json({ error: 'dataUrl required' });

  // if unsigned preset + cloud name provided, use direct Cloudinary unsigned upload (server acts as proxy)
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if(!cloudName) return res.status(500).json({ error: 'CLOUDINARY_CLOUD_NAME not configured' });

  try{
    const timestamp = Math.floor(Date.now() / 1000);
    const form = new FormData();
    form.append('file', dataUrl);

    // If API key/secret present, use signed upload
    if(apiKey && apiSecret){
      form.append('api_key', apiKey);
      form.append('timestamp', String(timestamp));
      if(folder) form.append('folder', folder);
      // signature is sha1 of params string + api_secret. For minimal params we sign timestamp and folder if present.
      let toSign = `timestamp=${timestamp}`;
      if(folder) toSign += `&folder=${folder}`;
      toSign += apiSecret;
      const signature = crypto.createHash('sha1').update(toSign).digest('hex');
      form.append('signature', signature);
    }else if(uploadPreset || process.env.CLOUDINARY_UPLOAD_PRESET || process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET){
      // fallback to unsigned preset if provided
      const preset = uploadPreset || process.env.CLOUDINARY_UPLOAD_PRESET || process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
      form.append('upload_preset', preset);
      if(folder) form.append('folder', folder);
    }else{
      return res.status(500).json({ error: 'No upload method configured (api key/secret or unsigned preset).' });
    }

    const url = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
    const uploadRes = await fetch(url, { method: 'POST', body: form });
    const json = await uploadRes.json();
    if(!uploadRes.ok) return res.status(500).json({ error: 'Cloudinary upload failed', details: json });
    return res.status(200).json({ ok: true, url: json.secure_url, raw: json });
  }catch(e){
    console.error('upload-image error', e);
    return res.status(500).json({ error: 'upload failed', message: e?.message || String(e) });
  }
}
