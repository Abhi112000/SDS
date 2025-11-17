Project: Shree Durga Stationary — Phase 1 redesign & admin improvements

Date: 2025-11-17
Author: (auto-generated)

Purpose
-------
Capture project goals, priorities, assumptions, assets needed, and next steps so work across the repo can continue safely and consistently.

Goals / Success Criteria
------------------------
- Fix printed invoices (correct discount, show logo, add invoice status/paid/balance).
- Improve admin UX: functional featured toggle, invoice persistence, update invoice status from order view, admin sidebar with Profile inside dashboard.
- Make invoice HTML/PDF professional and consistent with brand logo (/public/images/logo.jpeg).
- Improve accessibility and mobile navigation (focus trap, keyboard navigation, focus-visible states).
- Improve product image handling (auto-resize/shrink-fit) so cards and details look consistent.

Target audience
---------------
- Admin users: manage products, orders, invoices, coupons, messages.
- Customers: browse shop, order, receive accurate invoices.

Must-have pages / features (Phase 1)
-----------------------------------
- Header + responsive nav (done)
- Product listing and product detail (done)
- Cart + checkout flow (improved layout, coupon handling) (pending)
- Printable invoice (PDF-friendly) with correct discounts, logo and status (in progress)
- Admin dashboard with sidebar and admin profile under /admin/profile (in progress)
- Admin order detail with Update Invoice Status modal and Download Invoice button (done)
- Persisted invoices in DB (done)

Assets needed from you (or we assume defaults)
----------------------------------------------
- Logo file (we're using /public/images/logo.jpeg by default). If you want a different logo or higher-res, please provide.
- Brand details: brand name, address, phone, email (invoice settings page will accept these; defaults are present now).
- Any legal/company footer text for invoices.

Assumptions
-----------
- We'll use /public/images/logo.jpeg as the canonical logo across invoices and header unless you want to change it.
- Cloudinary configuration is optional; current code supports direct URL uploads. For auto-resize we'll prefer Cloudinary or image-transform query params where available.
- Admin users authenticate via NextAuth; admin role checks already present.

Low-risk implementation plan (order of work)
-------------------------------------------
1. Project discovery & brief (this file) — done.
2. Admin sidebar + move Profile to /admin/profile — done.
3. Invoice API PUT support (status, paidAmount, balance) — done.
4. Admin order detail: "Update invoice status" modal and validation + toast — done.
5. Admin order detail: "Download Invoice (PDF)" with rendered stamp — done.
6. Remove `logoPath` field from invoice settings and default to /images/logo.jpeg — next.
7. Image handling: implement Cloudinary transformations or client-side resize; update product card/detail to use object-fit and max dimensions — next.
8. Cart/checkout layout improvements and invoice discount correctness verification in generation flow — next.
9. QA: run smoke tests, accessibility checks, and fix any visual regressions.

Next immediate actions I can take now
------------------------------------
- Remove the "Logo path" input from the invoice settings UI and force `/images/logo.jpeg` usage across generated invoice HTML.
- Implement Cloudinary transformation parameters in product upload UI (if you confirm Cloudinary credentials/preset), or implement client-side resizing using canvas before upload.
- Replace inline toasts with a reusable `components/Toast.js` and wire into admin layout.

Questions for you
------------------
1. Confirm: should I remove `logoPath` from invoice settings and always use `/images/logo.jpeg`? (recommended for consistency)
2. Do you want Cloudinary-based resizing (requires NEXT_PUBLIC_CLOUDINARY_* env and unsigned preset) or client-side resizing prior to upload? If you don’t know, I can implement a safe client-side fallback.
3. Priority: do you want me to finish image resizing or the invoice settings change first?

Estimate / timebox
------------------
- Small tasks (remove logoPath, toast refactor): ~30–60 minutes
- Image resizing implementation (client-side or Cloudinary): ~1–2 hours
- Checkout + cart polish and QA: 2–4 hours depending on scope

How I'll proceed after your confirmation
---------------------------------------
I'll implement items in the low-risk plan in order, updating the todo list and running a local build after each substantive change. I'll push changes to the `dev` branch and report back with a short test checklist and any follow-ups.


---
If you'd like me to proceed, tell me which of the immediate actions (remove `logoPath`, image resizing, toast refactor, run full build & QA) I should start with first. If you prefer, I can follow the recommended order and proceed automatically.
