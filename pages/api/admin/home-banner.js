import dbConnect from '@/lib/mongodb';
import HomeBannerSetting from '@/models/HomeBannerSetting';
import { getSession } from 'next-auth/react';
import { getToken } from 'next-auth/jwt';

const defaultSlides = [];

export default async function handler(req, res) {
  await dbConnect();

  if (req.method === 'GET') {
    const setting = await HomeBannerSetting.findOne().lean();
    const slides = Array.isArray(setting?.slides) && setting.slides.length ? setting.slides : defaultSlides;
    return res.status(200).json({ slides });
  }

  let session = await getSession({ req });
  if (!session) {
    try {
      const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
      if (token && token.sub) {
        session = { user: { id: token.sub, role: token.role || 'user' } };
      }
    } catch (e) {}
  }

  if (!session || session.user?.role !== 'admin') {
    return res.status(403).json({ error: 'admin required' });
  }

  if (req.method === 'PUT') {
    const payload = Array.isArray(req.body?.slides) ? req.body.slides : defaultSlides;
    const slides = payload
      .map((slide) => ({
        imageUrl: String(slide?.imageUrl || '').trim(),
        altText: String(slide?.altText || 'Stationery item').trim() || 'Stationery item',
        caption: String(slide?.caption || '').trim(),
        link: String(slide?.link || '/shop').trim() || '/shop'
      }))
      .filter((slide) => slide.imageUrl);

    const updated = await HomeBannerSetting.findOneAndUpdate(
      {},
      { slides, updatedAt: new Date() },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.status(200).json({ slides: updated?.slides || slides });
  }

  res.status(405).end();
}
