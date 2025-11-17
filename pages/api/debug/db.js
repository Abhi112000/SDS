import dbConnect from '@/lib/mongodb';

export default async function handler(req, res) {
  try {
    await dbConnect();
    // dbConnect logs details to server console; return friendly JSON
    res.status(200).json({ ok: true, message: 'DB check triggered (see server logs)' });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
}
