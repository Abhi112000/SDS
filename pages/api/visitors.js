import dbConnect from '@/lib/mongodb';
import VisitorSession from '@/models/VisitorSession';
import VisitorSetting from '@/models/VisitorSetting';

function inferDeviceType(userAgent = '', deviceType = '') {
  const normalized = (deviceType || '').toLowerCase();
  if (['desktop', 'laptop', 'phone', 'tablet'].includes(normalized)) {
    return normalized;
  }
  const ua = userAgent || '';
  if (/android|iphone|ipad|mobile/i.test(ua)) return 'phone';
  if (/windows|mac|linux/i.test(ua)) return 'laptop';
  return 'desktop';
}

export default async function handler(req, res) {
  await dbConnect();

  const setting = await VisitorSetting.findOne().lean().catch(() => ({ enabled: true }));
  const enabled = setting && typeof setting.enabled === 'boolean' ? setting.enabled : true;

  if (req.method === 'GET') {
    if (!enabled) return res.status(200).json({ enabled: false, count: 0, activeVisitors: [] });

    const cutoff = new Date(Date.now() - 2 * 60 * 1000);
    const activeVisitors = await VisitorSession.find({
      isActive: true,
      lastSeenAt: { $gte: cutoff }
    }).sort({ lastSeenAt: -1 }).limit(50).lean();

    return res.status(200).json({
      enabled: true,
      count: activeVisitors.length,
      activeVisitors
    });
  }

  if (req.method === 'POST') {
    if (!enabled) return res.status(200).json({ enabled: false, count: 0 });

    const body = req.body || {};
    const page = body.page || '/';
    const isAdminRoute = /^\/admin(?:\/|$)/.test(page);
    if (isAdminRoute) return res.status(200).json({ enabled: true, count: 0, action: 'ignored-admin' });

    const sessionId = body.sessionId || body.session || `guest-${Date.now()}`;
    const action = String(body.action || 'heartbeat').toLowerCase();
    const userAgent = body.userAgent || req.headers['user-agent'] || '';
    const deviceType = inferDeviceType(userAgent, body.deviceType || '');
    const userName = String(body.userName || '').trim();
    const email = String(body.email || '').trim();
    const userId = body.userId || null;
    const title = String(body.title || page || '').trim();
    const now = new Date();

    if (action === 'leave') {
      await VisitorSession.findOneAndUpdate(
        { sessionToken: sessionId },
        {
          $set: {
            isActive: false,
            lastSeenAt: now,
            page,
            userAgent,
            deviceType,
            userName: userName || undefined,
            email: email || undefined,
            userId: userId || undefined,
            updatedAt: now
          }
        },
        { upsert: true, new: true }
      ).catch(() => null);

      return res.status(200).json({ enabled: true, count: 0, action: 'leave' });
    }

    const entry = {
      path: page,
      title: title || page,
      action,
      deviceType,
      userAgent,
      timestamp: now
    };

    const current = await VisitorSession.findOneAndUpdate(
      { sessionToken: sessionId },
      {
        $set: {
          sessionToken: sessionId,
          isActive: true,
          deviceType,
          userAgent,
          page,
          lastSeenAt: now,
          updatedAt: now,
          userName: userName || undefined,
          email: email || undefined,
          userId: userId || undefined
        },
        $push: {
          pageHistory: {
            $each: [entry],
            $slice: -80
          }
        },
        $setOnInsert: {
          startedAt: now,
          createdAt: now
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).catch(() => null);

    const cutoff = new Date(Date.now() - 2 * 60 * 1000);
    const count = await VisitorSession.countDocuments({
      isActive: true,
      lastSeenAt: { $gte: cutoff }
    });

    return res.status(200).json({
      enabled: true,
      count,
      deviceType: current?.deviceType || deviceType,
      action
    });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
