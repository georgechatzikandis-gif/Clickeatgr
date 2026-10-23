# Going live — step by step

This guide has **not** been executed yet: nothing is deployed until you complete these steps and we verify the
live site together. Re-check every price on the vendor's own page before signing up.

## 0. Hosting choice: Cloudflare Workers

Chosen: **Cloudflare Workers** (with the `@opennextjs/cloudflare` adapter) and a Supabase database.

| Plan | Cost | What to expect (measured locally, October 2026) |
|---|---|---|
| Workers Free | €0 | Site size 1.75 MB (limit 3 MB) ✅. **10 ms CPU per request**: customer pages are light, but staff **login** needs ~110 ms CPU for secure password checking and will probably be refused (error 1102). |
| Workers Paid | $5/month | 30 s CPU per request, 10 MB size limit. Everything works. |

Start on Free. If you see "Worker exceeded resource limits" (dashboard → Workers → clickeat → Logs) or cannot log in,
switch to Paid in the dashboard: one click, no code change.

The same code still runs on any Node.js host (Vercel Pro, a VPS) as a fallback.

## 1. Domain

Buy `clickeat.gr` (or similar) from a Greek registrar. `.gr` domains are registered for 2 years. Do this early,
because the name might be taken.

## 2. Database (Supabase)

1. Create an account at supabase.com → **New project** → region **Central EU (Frankfurt)**. Choose a strong
   database password and store it in a password manager.
2. **Project Settings → Data API**: turn the Data API **off** (the app doesn't use it). All tables also have
   Row-Level Security enabled with no policies, so they stay closed even if the Data API is left on.
3. **Connect** (top bar) → copy two connection strings:
   - **Transaction pooler** (port **6543**): used by the website → `DATABASE_URL` on the host.
   - **Session pooler** (port **5432**): used for migrations and backups.
4. On your computer, create the tables and base data in production:

   ```bash
   DATABASE_URL="<session pooler URI>" pnpm db:migrate
   DATABASE_URL="<session pooler URI>" pnpm db:seed
   DATABASE_URL="<session pooler URI>" pnpm user:create admin you@yourmail.gr
   ```

   Never run `db:seed:demo` against production.

## 3. Cloudflare Workers

1. Create a free account at cloudflare.com.
2. **Hyperdrive** (fast, pooled database connection, free): dashboard → *Storage & databases → Hyperdrive → Create*.
   Use the Supabase **session pooler** URI (port **5432**, not the 6543 transaction pooler). Copy the Hyperdrive **ID**
   and put it in `wrangler.jsonc`:
   `"hyperdrive": [{ "binding": "HYPERDRIVE", "id": "<hyperdrive-id>" }]` (commit this; the ID is not a secret).
3. **Workers → Create → Import a repository** → choose this GitHub repository and set:
   - Build command: `pnpm install --frozen-lockfile && pnpm cf:build`
   - Deploy command: `npx opennextjs-cloudflare deploy`
4. Worker → *Settings → Variables and secrets*: add **secret** `APP_SECRET` (output of
   `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).
5. Every push to `main` now deploys automatically. Deploys are not limited on Workers.

Test locally in Cloudflare's runtime before deploying: `pnpm cf:preview` (uses `.dev.vars`, see `.dev.vars.example`).

## 4. Point the domain to the host

1. Cloudflare dashboard → *Add a domain* → enter `clickeat.gr` → Free plan. Cloudflare shows two **nameservers**.
2. At your Greek registrar, replace the domain's nameservers with Cloudflare's (can take a few hours).
3. Workers → clickeat → *Settings → Domains & Routes → Add custom domain* → `clickeat.gr` and `www.clickeat.gr`.
   HTTPS is automatic.

## 5. Backups (free, encrypted)

The repository includes `.github/workflows/backup.yml`, which dumps the database nightly, encrypts it and keeps 30
days of copies in GitHub Actions.

1. GitHub → repository → **Settings → Secrets and variables → Actions → New repository secret**:
   - `PRODUCTION_DATABASE_URL` = Supabase **session pooler** URI
   - `BACKUP_PASSPHRASE` = a long random passphrase. **Store it in your password manager** — without it the
     backups cannot be opened.
2. **Actions → Nightly database backup → Run workflow** once, and check that a `.gpg` file appears.
3. Restoring (practise once):

   ```bash
   gpg -d clickeat-YYYYMMDD-HHMM.dump.gpg > backup.dump
   pg_restore --no-owner --clean --if-exists -d "<database URL>" backup.dump
   ```

The same secret lets `.github/workflows/maintenance.yml` anonymise customer details older than 12 months (GDPR).

## 6. Launch checklist

- [ ] Legal items in `docs/PLAN.md` §5 handled; privacy & terms pages completed with your company details.
- [ ] Each partner business: account created (Admin → Καταστήματα), menu with **allergens**, hours, zones, photos.
- [ ] Business marked **Ενεργό**; trial end date left empty (free until you decide).
- [ ] Admin → Ρυθμίσεις: commission **off**.
- [ ] Place a real test order on your phone → the business accepts it on their phone → mark completed.
- [ ] Each business keeps `/dashboard` open on a phone or tablet, with sound enabled and the screen kept on.
- [ ] Backup workflow ran successfully.
- [ ] Bookmark `/admin` and log in from your phone.

## 7. Updating the live site later

1. Make changes on a branch, run `pnpm lint && pnpm typecheck && pnpm test`, open a pull request.
2. If the change includes a new migration in `drizzle/`, run it against production **before** merging:
   `DATABASE_URL="<session pooler URI>" pnpm db:migrate`.
3. Merge to `main` → the host redeploys automatically.
