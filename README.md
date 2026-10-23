# ClickEat — online food ordering for Rhodes

One central website where customers order from local businesses (guest checkout, cash on delivery or
payment at pickup), businesses manage orders and menus from any browser, and the platform owner
manages everything from an admin dashboard. Commission is 0% during the free trial and can be
switched on later from the admin dashboard, without code changes.

- Architecture, costs and legal checklist: [`docs/PLAN.md`](docs/PLAN.md)
- Going live step by step: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)

## Run it on your computer

Requirements: Node.js 22, pnpm (`corepack enable`), PostgreSQL 16+.

```bash
pnpm install
cp .env.example .env.local        # then edit DATABASE_URL and APP_SECRET
pnpm db:migrate                   # create the tables
pnpm db:seed:demo                 # DEMO data only — prints demo logins
pnpm dev                          # http://localhost:3000
```

Demo logins (local only, password `demo-password-123`):
`admin@demo.clickeat.local`, `pizza@demo.clickeat.local`, `souvlaki@demo.clickeat.local`, `cafe@demo.clickeat.local`.

| Page | URL |
|---|---|
| Customer site | `/` |
| Business dashboard | `/dashboard` |
| Admin dashboard | `/admin` |
| Staff login | `/login` |

## Tests

```bash
createdb clickeat_test             # once; or set TEST_DATABASE_URL
pnpm test                          # unit + database integration tests
pnpm test:e2e                      # browser tests (needs the demo data and a running app)
pnpm lint && pnpm typecheck
```

## Useful commands

| Command | What it does |
|---|---|
| `pnpm db:generate` | Create a migration after changing `src/db/schema.ts` |
| `pnpm db:migrate` | Apply migrations to the database in `DATABASE_URL` |
| `pnpm db:seed` | Base data for production (Rhodes region, food categories) |
| `pnpm user:create admin you@example.com` | Create an admin (asks for the password) |
| `pnpm user:create business owner@shop.gr <slug>` | Create a business login |
| `pnpm data:anonymize` | GDPR retention (dry run; add `--apply`) |

## Project layout

```
src/app/(shop)      customer pages: home, /r/[slug], checkout, /order/[id], legal
src/app/(staff)     /login, /dashboard (business), /admin
src/app/actions     server actions (the only way data is changed)
src/server          database access, auth, orders, images (server-only)
src/lib             pure logic: pricing, commission, hours, validation (unit-tested)
src/db/schema.ts    database schema
drizzle/            SQL migrations
scripts/            seed, user creation, retention
tests/              unit, integration (real Postgres), e2e (Playwright)
```
