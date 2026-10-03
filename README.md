# Reverse Hackathon 2026 — Mission Deck

Registration site for the Reverse Hackathon 2026, run by **The Whitehatians**, Department of
Cyber Security, SRM Valliammai Engineering College. A three-hour defensive sprint: teams receive an
already-built, deliberately vulnerable system and must find, patch and defend the fixes.

**Live site:** <https://reverse-hack.vercel.app/>

## What is in this repo

| Path | What it is |
| --- | --- |
| `index.html` | The whole public site — markup, CSS and JS in one file. This is what visitors get. |
| `admin.html` | Organiser dashboard. Asks for `ADMIN_KEY`, shows totals, proof viewer and Excel download. |
| `hero-bg.jpg`, `superman-hero.jpg`, `about-bg.jpg`, `standards-bg.jpg`, `dc-contact-art.jpg`, `dc-contact-clear.jpg`, `srm-valliammai-logo.jpg`, `assets/superman-hero.png` | Section backgrounds and art. All local — nothing is hotlinked. |
| `assets/villains/` | The 15 gallery cards, downloaded from the old CDN so the site no longer depends on a third-party host. |
| `assets/upi-qr.jpeg` | UPI QR code shown in the payment step. |
| `og-deck.png` | Open Graph preview image. |
| `api/` | Vercel serverless functions (Node). Registration storage + organiser API. |
| `scripts/check-site.mjs` | Pre-deploy check. Run it before every deploy. |
| `dev-host.cjs` | Local-only helper that serves the static site and runs `api/` without Vercel. |
| `src/`, `next.config.mjs`, `tailwind.config.ts` | An older Next.js draft with a different theme. **Not deployed** — see "Legacy files" below. |

The public site is a static HTML file plus serverless functions. There is no build step for the
front end, and no framework.

## Event facts

- **Date:** Tuesday, 13 October 2026, 09:00 IST (gates 08:00, ledger closes 07:00)
- **Format:** solo, or a duo (Capo/team lead + exactly one partner)
- **Eligibility:** DEP-CYS students, years I–III
- **Fee:** ₹100 per participant (a duo pays ₹200)

The date lives in six places inside `index.html` — meta description, the `content:` string in
`.landing-art-frame::after`, the hero date line, the "ENTRY STATUS" badge, the contact block, and
`EVENT_TIME` for the countdown. Change all six together.

## Tech

- Static HTML/CSS/vanilla JS, jQuery only for the small chat widget
- Vercel serverless functions (Node 18+, CommonJS)
- MongoDB Atlas (free M0 tier) via the official `mongodb` driver
- ExcelJS for the `.xlsx` export
- No bundler, no transpiler, no framework runtime

## Environment variables

Set these in **Vercel → Settings → Environment Variables** (and in `.env.local` for local work).
See `.env.example`. Never commit real values.

| Variable | Purpose |
| --- | --- |
| `SMTP_HOST`, `SMTP_PORT` | Gmail SMTP (`smtp.gmail.com`, `465`) |
| `SMTP_USER`, `SMTP_PASS` | Mailbox + **App Password** (see below) |
| `MAIL_FROM` | Optional display sender. Defaults to `SMTP_USER` |
| `MAIL_NOTIFY_TO` | Optional. Comma-separated. CC/BCC yourself on every confirmation |
| `MONGODB_URI` | Atlas connection string, e.g. `mongodb+srv://user:pass@cluster.mongodb.net` |
| `MONGODB_DB` | Database name (default `reversehack2026`) |
| `ADMIN_KEY` | Long random string that unlocks `/admin` and every `/api/admin/*` route |

Generate a key with:

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

> **Gmail needs an App Password, not your account password.** If 2-Step Verification is on (and it
> should be), the real password is rejected by `smtp.gmail.com`. Go to
> <https://myaccount.google.com/apppasswords>, generate a 16-character App Password, and paste that
> into `SMTP_PASS`. Port 465 with `secure: true` is already handled.

Confirmation mail is sent **after** the registration is committed to MongoDB and the response is
built, so an SMTP outage can never lose an entry. If mail fails the registration still succeeds and
the response reports `"emailSent": false`.

### Creating the free MongoDB cluster

1. Sign up at <https://www.mongodb.com/atlas/register> and choose the free **M0** tier.
2. **Create a deployment** — region closest to the college (Chennai), free tier.
3. **Database Access** → *Add New Database User* → set a username and password → role
   **Read and write to any database**.
4. **Network Access** → *Add IP Address*. Vercel's outbound IPs are dynamic, so either allow
   `0.0.0.0/0` (simplest, accepts the risk) or add Vercel's published ranges.
5. **Deploy** → green **Connect** button → **Drivers** → copy the connection string.

No manual collection setup is needed: `api/_lib.js` creates the indexes on first write, including
a unique index on the lowercased team name and another on participant emails.

> M0 free tier is **5 GB shared across the whole cluster** and caps a document at 16 MB. Payment
> screenshots (≤2 MB) fit comfortably; do not store PDFs or videos there.

## Registration and payment

Every question is mandatory. `api/_lib.js` is the single source of truth for validation, and the
page mirrors each server-side error back onto the matching input.

The form collects: crew format (solo/duo), team name or solo alias, the lead's name, email, phone,
year, department, gender and register number, the partner's name/year/register number (duo only),
one of 15 domains, T-shirt size, how they heard about the event, the rules checkbox, the **UPI
transaction/UTR id**, and a **payment screenshot**.

The screenshot is downscaled in the browser through a canvas (max edge 1400 px, JPEG q0.82) before
upload, so a 4 MB phone photo becomes roughly 200 KB. The server rejects anything over 2 MB, any
mime type outside JPEG/PNG/WebP, and any payload whose base64 does not round-trip — the decoded
byte length is what gets stored, never the size the client claims.

Registration closes at **13 October 2026, 07:00 IST**; after that `/api/register` returns `403`.

### API

| Route | Method | Auth | Purpose |
| --- | --- | --- | --- |
| `/api/register` | POST | none | Store one registration + proof. `201`, or `400` with `fieldErrors`, `409` on duplicate team/email, `403` after the deadline, `503` if Mongo is unreachable. |
| `/api/admin/registrations` | GET | `x-admin-key` | All registrations with the screenshot bytes stripped, plus totals. |
| `/api/admin/proof?id=<id>` | GET | `x-admin-key` | Streams one stored screenshot. |
| `/api/admin/export` | GET | `x-admin-key` | Streams a styled `.xlsx`. |

The admin key is compared with `crypto.timingSafeEqual`, so it cannot be probed byte by byte.
Proofs are served `private, no-store` and are only ever fetched with the key attached — there is no
guessable public URL for a screenshot.

## Organiser dashboard

Open `/admin`, paste the `ADMIN_KEY`, and the dashboard shows registrations, participants, the
solo/duo split and total fee collected. You can filter the table, open any payment screenshot, and
download a workbook with three sheets:

- **Participants** — one row per human. This is what the check-in desk wants.
- **Registrations** — one row per entry. This is what reconciles payments.
- **Summary** — headline totals.

The key is held in `sessionStorage`, so it disappears when the tab closes.

## Local development

There is nothing to build. To browse the site:

```bash
python -m http.server 8080     # or any static server
```

The API needs Node, so use the bundled helper or `vercel dev`:

```bash
npm install
# terminal 1 - static site + api/ on http://localhost:3100
set MONGODB_URI=...&& set ADMIN_KEY=...&& node dev-host.cjs
# or, with the Vercel CLI (closest to production):
npx vercel dev
```

`vercel dev` is the better option because it runs the functions exactly as Vercel will.

## Deploy

`vercel.json` pins `framework: null` so Vercel serves `index.html` as a static file and does **not**
try to build the leftover Next.js app. Keep the project's Framework Preset on **Other**.

1. Push the repo.
2. Vercel → **New Project** → import → preset **Other**.
3. Add `MONGODB_URI`, `MONGODB_DB` and `ADMIN_KEY` under **Environment Variables**.
4. Deploy. `/`, `/admin.html` and `/api/*` all work immediately.

## Before you go live

1. **Confirm the payment details.** `api/_lib.js` has `PAYMENT.amountPerPerson` (`100`) and
   `PAYMENT.payeeName`, and `index.html` shows the payee next to the QR. There is deliberately **no
   typed UPI id on the page** — the QR is the only payment instruction, so there is nothing to fall
   out of sync. That also means the QR *must* be right: check that `assets/upi-qr.jpeg` encodes the
   account you actually want to be paid, for the amount shown, before you announce anything.
2. **Confirm the date** in all six places listed above.
3. **Set `ADMIN_KEY`** to a real secret. Do not reuse the local value.
4. **Contact email.** `CONTACT_EMAIL` in `index.html` is still
   `registration@whitehatians.in`. The confirmation mailto button uses it. Change it to the
   organiser mailbox (`SMTP_USER`) so replies land in the same inbox.
5. Proofread the fee, domain list and schedule against your announcement.

## Deploy checklist

```bash
npm install
npm run check        # assets, inline JS, tags, ids, dates, branding, secrets
```

`npm run check` exits non-zero on any problem and is the fastest way to catch a missing image or a
leftover reference before you push.

## Legacy files

`src/`, `next.config.mjs`, `tailwind.config.ts`, `postcss.config.mjs`, `tsconfig.json` and
`future-of-creative-ai-summit.html` are from an earlier Next.js draft with a different theme. The
deployed site does not use them and `vercel.json` prevents Vercel from building them. Delete them
once you are comfortable — but note `npm run dev` currently starts that old app, not this site.
