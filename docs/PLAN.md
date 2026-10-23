# ClickEat — Architecture, Costs & Implementation Plan

Status: Stages 1–3 complete (MVP built and tested locally). Stage 4 (deployment) not started — see `docs/DEPLOYMENT.md`.
Last reviewed: October 2026. All prices must be re-checked on the vendor's own pricing page before you sign up.

---

## 1. What exists today

The repository started with only the ClickEat logo. Everything else is new.

## 2. Architecture (one app, one database)

```
Browser (customer / business / admin)
        │  HTTPS
        ▼
Next.js 16 app (TypeScript, Tailwind)  ──►  PostgreSQL (one central DB)
  • public pages (Greek)                     • all businesses, menus, orders
  • server actions = the only write path     • images (resized WebP, stored in DB for MVP)
  • all prices recomputed on the server      • sessions, rate limits, commission ledger
```

Key decisions and why:

| Decision | Choice | Why |
|---|---|---|
| Framework | Next.js 16 App Router + TypeScript | One codebase for site, dashboards and API. |
| Styling | Tailwind CSS 4 | Fast to build mobile-first UI, no paid UI kit. |
| Database | PostgreSQL via Drizzle ORM (`postgres` driver) | Standard Postgres, so we can move between Supabase, Neon, or a VPS without rewriting code. |
| Auth | Own session auth for **staff only** (admin + business users), scrypt password hashing, DB-stored sessions, httpOnly cookies | Customers check out as guests, so only a handful of staff accounts exist. No third-party auth service is needed and there is nothing to pay for. |
| Authorization | Every server action calls `requireAdmin()` or `requireBusinessUser()` and every business query is filtered by the business id **taken from the session**, never from the browser. Row-Level Security is enabled on all tables with no policies, so no database role other than the app's owner role can read anything (blocks Supabase's public Data API) | Real server-side enforcement, covered by automated tests. |
| Real-time orders | Polling every 10 s while the dashboard is open, with sound + tab-title alerts | Free, works on any host, no WebSocket service. Plenty for 2–3 businesses. |
| Images | Uploaded, resized to WebP (max 1200 px) with `sharp`, stored in Postgres, served with long cache headers | Zero extra services. ~100 KB/image → a few hundred images ≈ 30–50 MB. Can move to Supabase Storage / Cloudflare R2 later behind the same interface. |
| Maps / addresses | No maps API. Each business defines **named delivery zones** (e.g. "Ρόδος – Πόλη", "Ιξιά", "Φαληράκι") with its own fee and minimum | No per-request costs; matches how local shops already price delivery. |
| Email | Optional later (Resend free: ~3,000/month, 100/day). The platform works without it. | |
| Rate limiting | Postgres table (fixed window) | No Redis needed. |
| Duplicate orders | Client generates an idempotency key per checkout; DB unique constraint returns the existing order on retry | Double-clicks and flaky mobile networks cannot create two orders. |

### Customer flow
Home → business page (`/r/<slug>`) → cart (one business only, stored in the browser) → checkout (`/r/<slug>/checkout`) → server validates everything and recalculates totals → confirmation page `/order/<id>?t=<secret>` with reference number and live status.

### Business dashboard (`/dashboard`)
Live orders board (new orders highlighted, sound alert), accept/reject, status changes, history, menu management (categories, products, options/extras, images, availability), settings (hours, temporary closure, delivery zones, fees, minimums, pickup/delivery).

### Admin dashboard (`/admin`)
Businesses (create/edit/suspend/deactivate), business user accounts, categories, all orders with filters, platform statistics, commission & trial settings, monthly reports.

## 3. Database schema (summary)

See `src/db/schema.ts` for the authoritative definition.

- `regions` — Rhodes now, more Dodecanese islands later.
- `categories` + `business_categories` — food categories (coffee, souvlaki, pizza…).
- `businesses` — profile, status (`active` / `inactive` / `suspended`), temporary closure, delivery/pickup flags, prep & delivery times, **trial_ends_at**, **commission_rate_bps** (override), **commission_base** (override).
- `business_hours` — one or more time ranges per weekday (supports past-midnight closing).
- `delivery_zones` — per business: name, fee, minimum order.
- `menu_categories`, `products`, `option_groups`, `options` — the menu, with min/max selections and extra prices.
- `images` — resized image bytes.
- `orders` — customer details, address, zone snapshot, money fields (all in **cents**, integers), idempotency key, public access token, status, and commission snapshot: `commissionable_cents`, `commission_rate_bps`, `commission_cents`, `is_trial`, `commission_status` (`not_applicable` / `pending` / `due` / `settled`).
- `order_items` — snapshot of product name, chosen options and prices at the time of ordering.
- `order_events` — every status change, who made it, when.
- `commission_ledger` — every commission calculation and every reversal (append-only).
- `platform_settings` — global commission switch (OFF), default rate (5 % prepared, inactive), default commission base (`subtotal` — delivery fee NOT included).
- `users`, `sessions`, `rate_limits`.

### Commission rules (implemented in `src/lib/commission.ts`)
1. If the global commission switch is OFF → 0 %, `is_trial = true`, status `not_applicable`.
2. If the business has no trial end date, or the end date is in the future → 0 %, trial.
3. Otherwise rate = business override or platform default; base = subtotal (or subtotal + delivery if configured) minus discounts.
4. Commission is `pending` while the order is open, becomes `due` only when the order is **completed**, and is reversed (ledger entry, amount 0) when an order is rejected or cancelled.
5. Nothing is ever collected automatically in this version — it is only recorded for reporting.

## 4. Hosting & monthly cost

**Important findings (Oct 2026):**
- **Vercel Hobby (free) forbids commercial use.** A real business needs Vercel Pro: **$20/month**.
- **Supabase Free**: 500 MB database, no automatic backups, project paused after 7 days of low activity (real orders will keep it awake). Pro is **$25/month** with daily backups.
- **Neon Free**: ~1 GB storage, 100 compute-hours/month per project, scales to zero after 5 minutes idle. A dashboard polling all day keeps the database awake, which could use up those hours. Launch plan is usage-based, roughly $5–15/month at our size.
- **Netlify Free** is reported to allow commercial use (credit-based; all projects pause if credits run out).

### Recommended options

| Option | Fixed monthly | Pros | Cons |
|---|---|---|---|
| **A. Lowest cost to start** — Netlify Free + Supabase Free (as plain Postgres) + nightly backup via GitHub Actions | **€0** + domain | Free; commercial use allowed | Free-tier limits; you must watch them; backups are our own script |
| **B. Most reliable managed** — Vercel Pro + Supabase Free + GitHub Actions backups | **~$20** + domain | Best Next.js support, very low ops work | $20/month fixed |
| **C. Cheapest "all-in"** — small VPS (Hetzner/other, ~€5–8) with Docker (app + Postgres) | **~€5–8** + domain | No free-tier limits, fixed price | You are responsible for server updates and backups |

**Recommendation:** start with **Option A** during the free trial with 2–3 businesses (backups covered by our own nightly `pg_dump` in GitHub Actions). Move to B or Supabase Pro once orders are steady and the business pays for itself. The code runs unchanged on all three options.

| Cost item | Type | Estimate |
|---|---|---|
| Domain (e.g. `clickeat.gr`) | Fixed, yearly | ~€15–30 / year (.gr is registered for 2 years at a time) |
| Hosting | Fixed | €0 (A) / ~$20 (B) / ~€5–8 (C) |
| Database | Fixed | €0 (free tier) / $25 (Supabase Pro, later) |
| Email notifications | Usage | €0 up to ~3,000/month (optional) |
| Error monitoring (Sentry free) | Usage | €0 (optional, not required for launch) |
| Analytics | — | €0 (host's basic analytics or none) |
| SMS, maps, payments | — | **Not used.** Not added without your approval. |

## 5. Legal / business issues to resolve before launch

I am not a lawyer; please confirm these with a Greek accountant/lawyer.

1. **Your legal entity.** To charge commission later you need a registered business (ΑΦΜ, ΓΕΜΗ if applicable) and must issue invoices through **myDATA (ΑΑΔΕ)**. During a 0 % trial no platform invoice is issued.
2. **Restaurant receipts.** Each restaurant remains the seller and must issue its own legal receipt for each order (as they do today for phone orders).
3. **GDPR.** The platform stores customer name, phone, address. Needed: privacy notice (draft included at `/privacy`), a data-retention rule (proposal: anonymise customer details 12 months after the order), and data processing agreements with your hosting/database providers (both offer standard DPAs). Choose EU regions (e.g. Frankfurt) for the database.
4. **Food information / allergens (EU Reg. 1169/2011).** For distance selling, allergen information must be available **before** purchase. Products have an allergens field shown to customers; each business must fill it in.
5. **Platform-to-Business Regulation (EU 2019/1150).** Requires clear terms for businesses (ranking, suspension, fees). Draft business terms are needed before the trial.
6. **Terms of use / imprint.** Company details, contact, and complaint handling on the site (draft at `/terms`).
7. **Cookies.** The site only uses strictly necessary cookies (staff login) and browser storage for the cart, so no cookie banner is required. Adding analytics or ads changes this.

## 6. Stages

1. **Planning** — this document. ✅
2. **MVP** — storefront, cart, guest checkout (cash), business dashboard, admin dashboard. ✅
3. **Testing** — unit tests (prices, commission, opening hours), integration tests against real Postgres (order placement, authorization, duplicates), browser end-to-end tests on mobile and desktop viewports. ✅ (locally, against a production build)
4. **Deployment** — chosen host, domain, env vars, database, backups.
5. **Expansion** — online payments (Stripe Connect / Viva), automatic commission, refunds, more islands, push notifications, English UI.

## 7. Known limitations of the MVP (deliberately left out)

- **Greek only.** English UI is not implemented yet (texts are in the components; adding a dictionary is a later step).
- **No email/SMS notifications.** Businesses get sound + visual alerts while `/dashboard` is open; customers follow
  the status on their order page. Email (Resend free tier) can be added later.
- **Polling, not push.** The dashboard checks every 10 s. A closed browser tab gets no alerts.
- **Location selector** shows only Rhodes; more regions can be added from the admin, but the home page is not yet
  region-switchable.
- **Admins cannot edit a business's menu directly** (they can edit profile, status, trial/commission, zones and
  accounts). A business user does the menu, or the admin creates a business login for themselves.
- **No scheduled/pre-orders, discounts or coupons.** The `discount_cents` field exists for later.
