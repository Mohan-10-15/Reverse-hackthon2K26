# Project instructions

Maintain the existing Reverse Hackathon 2026 website as a static HTML/CSS/JavaScript site with Vercel serverless functions. The public landing/registration page is `index.html`; the participant portal is `user.html`; the organiser dashboard is `admin.html`. Preserve the existing comic-book / superhero visual identity unless the user requests a redesign. Do not add a framework or build step.

## Confirmed event rules

- Reverse Hackathon 2026, organised by The Whitehatians, Department of Cyber Security, SRM Valliammai Engineering College.
- Event: 13 October 2026, 09:00 IST; gates open 08:00 IST; registration ledger closes 07:00 IST.
- Registration is free. Never add a QR code, UPI field, transaction ID, payment, receipt, screenshot, or proof upload.
- Entry format is Solo or Duo. A Duo has one lead and exactly one partner; no team may exceed two people.
- Eligibility: DEP-CYS students in years I–III.

## Registration and participant workspace

- Keep the primary-participant and conditional partner fields validated on both client and server.
- Every entry has a unique team name / Solo alias. That name is the workspace username.
- Registration collects a required 8–72 character workspace password. Validate server-side and store only a per-entry scrypt hash and random salt. Never log, email, export, return from an API, or place the plaintext password in browser storage.
- Show the username and plaintext password only once in the successful registration confirmation UI; tell participants to save it. The confirmation email must never contain the password.
- `user.html` signs in with team name + password, uses an HttpOnly, Secure-on-Vercel, SameSite=Lax cookie and signed seven-day session, and exposes only that team's own safe profile, problem statement, solution, and read-only mark.
- Workspace submissions may contain a problem statement up to 5,000 characters and a solution up to 8,000 characters. Render user content as text, never trusted HTML. Team users must not be able to set their own mark.
- Do not let team APIs return participant emails, mobile numbers, register numbers, password hashes, or organiser keys.

## Organiser review

- `/admin.html` remains protected by `ADMIN_KEY` and the existing timing-safe guard.
- Organisers can read submissions and set/clear an integer mark from 0 to 100 through a protected API. Scores are read-only in participant accounts.
- The organizer dashboard and Excel export must exclude password hashes, salts, plaintext passwords, and legacy payment data. The export should include submission text, score, and update timestamps.
- Do not add deletion or bulk-edit controls unless specifically requested.

## Security and verification

- Do not commit environment values, admin keys, session secrets, or local credentials. `TEAM_SESSION_SECRET` is optional; when unset, server code derives a domain-separated signing key from `ADMIN_KEY`.
- Keep MongoDB allowlisting narrow; never open Atlas to `0.0.0.0/0` as a shortcut.
- For changes, run `npm run check`, `node --check` on every API file, and tests covering password hashing/session tamper rejection, Solo/Duo validation, protected workspace ownership, workbook columns, and mark limits.
- Do not perform a production registration write unless the user has explicitly approved the exact synthetic payload and side effects. Prefer local/mock tests for implementation verification.
