# ClickEat — notes for Claude Code

@AGENTS.md

- Read `docs/PLAN.md` first: architecture, commission rules, cost constraints.
- UI text is Greek. Money is integer cents; format with `formatEuro`. Times are Europe/Athens (`src/lib/hours.ts`).
- Never trust the browser: prices, options, fees and commission are recomputed in `src/server/orders.ts`.
- Every business-side query/mutation must filter by `businessId` from `requireBusinessUser()`; admin actions call `requireAdmin()`.
- Schema change → edit `src/db/schema.ts`, run `pnpm db:generate`, commit the migration.
- Before committing: `pnpm lint && pnpm typecheck && pnpm test`. E2E: `pnpm test:e2e` (demo data + running app;
  in the cloud sandbox set `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium`).
- Do not add paid services (SMS, maps, payments, email) without the owner's approval.
- Hosting is Cloudflare Workers (OpenNext). No native Node modules (e.g. sharp). The `db` export opens a per-request
  connection on Workers (`src/db/index.ts`). Check Workers compatibility with `pnpm cf:preview` and
  `E2E_BASE_URL=http://127.0.0.1:8787 pnpm test:e2e`.
