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
