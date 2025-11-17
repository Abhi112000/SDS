# Shree Durga Stationary — Starter

## Quick start

1. Copy this folder to your machine.
2. Copy `.env.local.example` to `.env.local` and fill values. Ensure `NEXTAUTH_URL` is present and points to your dev URL (for example `http://localhost:3000`) — missing `NEXTAUTH_URL` commonly causes the NextAuth client fetch error.
3. `npm install`
4. `npm run dev`
5. Optionally seed sample products:
   - `node scripts/seed.js` (ensure MONGODB_URI is set)

This scaffold uses Next.js (Pages Router), NextAuth (Credentials + Google), MongoDB (Mongoose), Tailwind CSS, and Pusher (for realtime hooks).

Replace and extend components, styling, and APIs as needed.

## Troubleshooting / Deploy checklist

If the app works locally but shows a 500 or the Admin panel is unavailable after deploying to Vercel, check the following:

1. Environment variables — make sure you set these in Vercel (Project → Settings → Environment Variables):
   - `MONGODB_URI` (required for DB-backed pages and admin)
   - `NEXTAUTH_URL` (set to your Vercel URL, e.g., `https://your-app.vercel.app`)
   - `NEXTAUTH_SECRET` (a strong random string)
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (if you use Google auth)
   - `NEXT_PUBLIC_PUSHER_KEY` / `NEXT_PUBLIC_PUSHER_CLUSTER` (if using Pusher)

2. Use the built-in debug endpoints (deployed) to check status without exposing secrets:
   - `/api/debug/env` — returns which critical env vars are present (booleans only).
   - `/api/debug/db` — triggers a DB connection attempt and logs details to the server logs.
   - `/api/debug/session` — shows NextAuth client/server session info (useful for troubleshooting auth issues).

3. Common quick fixes:
   - Ensure your MongoDB Atlas IP allowlist permits connections from Vercel (or use a VPC/Private Endpoint).
   - If you change env vars in Vercel, redeploy to pick them up.
   - Enable `NEXTAUTH_DEBUG=true` temporarily in Vercel to see NextAuth traces in server logs.

4. Local development checklist:
   - Copy `.env.local.example` to `.env.local` and set values for local testing.
   - Run `npm install` and then `npm run dev`.
   - Use `http://localhost:3000/api/debug/env` and `http://localhost:3000/api/debug/db` to confirm local configuration.

If you'd like, I can add an optional quick-start script that verifies environment variables and prints guidance before starting the dev server.
