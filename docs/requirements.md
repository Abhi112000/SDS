Pending Requirements and Next Steps

This document lists pending pointers and next steps derived from the User Dashboard, Admin Flow, and Registration & Auth requirements.

1. User Dashboard
- Profile editing: implement server-side validation, inline success messages, and client-side form validation. (pages/profile.js, pages/api/profile.js)
- Coupons: show active public coupons on dashboard and hide after user redeems one. (needs coupons API and per-user usage tracking)
- User analytics: optional aggregates (total orders, last order, coupons used) via server-side aggregations.

2. Help/Support
- Reply-from-user UX: added to dashboard modal; consider email notifications to admin for urgent messages.
- Message pagination and search for users and admins.

3. Admin
- Dashboard analytics: integrate Chart.js or Recharts and add MongoDB aggregation endpoints.
- Product image management: support deletion and multiple images per product; improve Cloudinary integration.
- Coupons: UI to create/edit/delete and mark public/private; API to mark coupon redeemed per-user.

4. Auth & Registration
- Forgot/reset: implemented basic flow; improve email templates and enforce rate limits on forgot endpoint.
- Password strength checks and confirm-password field on reset page.

5. Guest Orders
- Ensure guest orders are stored in a separate "GuestOrders" collection and flagged for admin review.
- Checkout UX: allow continue-as-guest or prompt registration/login.

6. Security & Production
- Use environment-managed secrets (Vercel env or other) for NEXTAUTH_SECRET, MONGODB_URI, SMTP credentials, and PUSHER keys.
- Add rate-limiting to sensitive endpoints and input sanitization.
- Add CORS rules and CSRF protections where needed.

7. Tests & CI
- Add unit tests for message APIs, profile update, and auth reset endpoints.
- Add a simple GitHub Actions workflow to run lint/tests on PRs.

Notes:
- SMTP: set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM` to enable real email delivery for password resets.
- Pusher: set `NEXT_PUBLIC_PUSHER_KEY`, `NEXT_PUBLIC_PUSHER_CLUSTER`, and server keys to enable real-time notifications.

Mark when completed by adding a checklist entry with date and commit hash.
