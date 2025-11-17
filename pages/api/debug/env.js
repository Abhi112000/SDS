export default function handler(req, res) {
  // Return presence status of critical environment variables without exposing secrets
  const vars = [
    'MONGODB_URI',
    'MONGODB_DB',
    'NEXTAUTH_URL',
    'NEXTAUTH_SECRET',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'NEXT_PUBLIC_PUSHER_KEY',
    'NEXT_PUBLIC_PUSHER_CLUSTER',
  ];
  const status = {};
  vars.forEach(k => { status[k] = !!process.env[k]; });
  // Provide NODE_ENV and a quick DB connect hint
  res.status(200).json({ ok: true, nodeEnv: process.env.NODE_ENV || 'development', vars: status });
}
