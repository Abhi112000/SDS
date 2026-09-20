import dbConnect from '@/lib/mongodb';
import VisitorSetting from '@/models/VisitorSetting';
import VisitorSession from '@/models/VisitorSession';
import { getSession } from 'next-auth/react';
import { getToken } from 'next-auth/jwt';

export default async function handler(req, res) {
  await dbConnect();

  let session = await getSession({ req });
  if (!session) {
    try {
      const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
      if (token && token.sub) {
        session = { user: { id: token.sub, role: token.role || 'user' } };
      }
    } catch (e) {
      // ignore token fallback errors
    }
  }

  if (!session || session.user.role !== 'admin') {
    return res.status(403).json({ error: 'admin required' });
  }

  if (req.method === 'GET') {
    const setting = await VisitorSetting.findOne().lean().catch(() => ({ enabled: true }));
    const enabled = setting && typeof setting.enabled === 'boolean' ? setting.enabled : true;
    const cutoff = new Date(Date.now() - 2 * 60 * 1000);

    const activeVisitors = await VisitorSession.find({
      isActive: true,
      lastSeenAt: { $gte: cutoff }
    }).sort({ lastSeenAt: -1 }).limit(50).lean();

    const history = await VisitorSession.find({}).sort({ lastSeenAt: -1 }).limit(100).lean();

    const summary = {
      desktop: activeVisitors.filter(v => v.deviceType === 'desktop').length,
      laptop: activeVisitors.filter(v => v.deviceType === 'laptop').length,
      phone: activeVisitors.filter(v => v.deviceType === 'phone').length,
      tablet: activeVisitors.filter(v => v.deviceType === 'tablet').length,
      unknown: activeVisitors.filter(v => v.deviceType === 'unknown').length
    };

    const historyByDate = {};
    for (const record of history) {
      const key = new Date(record.lastSeenAt || record.updatedAt || record.createdAt || Date.now()).toISOString().slice(0, 10);
      const userName = record.userName || record.email || 'Guest';
      if (!historyByDate[key]) historyByDate[key] = [];
      historyByDate[key].push({
        ...record,
        userLabel: userName,
        pageHistory: Array.isArray(record.pageHistory) ? record.pageHistory.slice(-10) : []
      });
    }

    return res.status(200).json({
      enabled,
      count: activeVisitors.length,
      activeVisitors,
      history,
      historyByDate,
      summary
    });
  }

  if (req.method === 'DELETE') {
    const date = (req.query?.date || req.body?.date || '').toString();
    if (!date) return res.status(400).json({ error: 'date required' });

    const start = new Date(`${date}T00:00:00.000Z`);
    const end = new Date(`${date}T23:59:59.999Z`);

    const deleted = await VisitorSession.deleteMany({
      lastSeenAt: { $gte: start, $lte: end }
    });

    return res.status(200).json({
      deletedCount: deleted.deletedCount || 0,
      date
    });
  }

  if (req.method === 'PUT') {
    const { enabled } = req.body || {};
    const updated = await VisitorSetting.findOneAndUpdate(
      {},
      {
        enabled: Boolean(enabled),
        updatedAt: new Date()
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.status(200).json({
      enabled: updated.enabled,
      updatedAt: updated.updatedAt
    });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
