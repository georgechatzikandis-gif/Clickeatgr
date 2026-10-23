# Going live — step by step

This guide has **not** been executed yet: nothing is deployed until you complete these steps and we verify the
live site together. Re-check every price on the vendor's own page before signing up.

## 0. Decide the hosting option (see `docs/PLAN.md` §4)

The app is a standard Next.js server app plus PostgreSQL, so any of these work without code changes.

| | Database | Web hosting | Fixed cost | Note |
|---|---|---|---|---|
| A | Supabase Free | Netlify Free | €0 | Check which region Netlify runs functions in: far from the database = slower pages |
| B | Supabase Free | Vercel Pro (region `fra1`) | ~$20/mo | Vercel Hobby is **not allowed** for commercial use |
| C | Same VPS | Small EU VPS + Docker | ~€5–8/mo | You maintain the server |

Keep the database and the web functions in the **same region (Frankfurt, EU)**. That keeps pages fast and
customer data inside the EU.

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

## 3. Web hosting

Connect the GitHub repository to the host and set:

| Setting | Value |
|---|---|
| Build command | `pnpm build` |
| Node version | 22 |
| `DATABASE_URL` | Supabase **transaction pooler** URI (port 6543) |
| `APP_SECRET` | output of `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| Function region | Frankfurt / EU Central |

Environment variables are entered in the host's dashboard and **never** committed to GitHub.

## 4. Point the domain to the host

In the host's dashboard, add the domain. It shows DNS records (usually an `A` record and a `CNAME` for `www`).
Add them at your registrar. HTTPS certificates are issued automatically (can take up to a few hours).

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
