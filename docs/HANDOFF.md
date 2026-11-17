# Backend handoff (Member 2, API only)

Backend only. No UI, no pages, no styling. Do NOT edit lib/sheets.ts, lib/formStandard.ts, or create /api/sheet/check (Member 3 owns them).
Do not run the dev server or write extra tests. I test manually with curl.exe (Windows PowerShell). Replies: 5 lines max.

## Rules
- Next.js App Router + TypeScript. Routes using googleapis/nodemailer: `export const runtime = 'nodejs'`.
- Responses: { ok: true, ... } or { ok: false, error, ...extra }. Status 400/401/404/409/422/500.
- Four standard titles come only from lib/formStandard.ts. Identity key = lowercase email. QR contains ONLY the Ticket ID.
- Data functions are imported only from lib/data.ts (mocks until Member 3 delivers). sheets: getTabs, readTab, appendRows, updateCell, ensureTabs.
- Every host handler calls requireHost(request). lib/auth.ts must be Edge-safe (no Node 'crypto').
- No secrets in code or logs.

## Contracts
- Accepted tab columns: A Ticket ID (10 uppercase A-Z0-9, Node crypto), B Email, C Full Name, D Organization, E Contact, F Accepted At (ISO), G Email Status ("Pending" / "Sent" / "Failed: reason"), H Check-in Status ("Not Checked In" / "Checked In"), I Check-in Time (ISO).
- Registrant: { email, name, organization, contact, timestamp, extra: Record<string,string> }. SkippedRow: { row, email?, reason }.
- GET /api/registrants: 422 { ok:false, error, missing, duplicates } if Form Check fails; else { ok:true, registrants (minus already accepted), skipped }.
- GET /api/accepted: { ok:true, accepted: AcceptedRow[], stats: { total, checkedIn } }.
- POST /api/accept { emails (1..20, lowercase) }: maxDuration 60; re-read sheet; process SEQUENTIALLY; recheck Accepted col B right before each append; in-memory in-flight Set; append row with status "Pending", make QR, send email, write G. Email failure does NOT roll back. Returns { ok:true, results:[{ email, status:'accepted'|'skipped'|'failed', ticketId?, emailStatus?, reason? }] }.
- POST /api/resend { ticketId }: 404 if not found; resend; update G; 500 + "Failed: reason" if send fails.
- POST /api/checkin { ticketId trimmed+uppercase }: 404 "Invalid ticket"; 409 "Already checked in" + name + checkedInAt; else set H, I and return { ok:true, name, organization, ticketId }. Re-read row before update + in-memory lock per ticket (Sheets has no atomic update; say so honestly).
- Email: Nodemailer Gmail SMTP, QR as inline CID attachment (<img src="cid:qr">), Ticket ID shown as text, HTML-escape name, plain-text alt.
- Middleware: /dashboard without session -> redirect /login; host API without session -> 401 JSON; /login and /api/auth/login public. Session: jose HS256, 8h, httpOnly cookie (secure in prod, sameSite lax). Check whether this Next.js version (16) uses proxy.ts instead of middleware.ts and use the supported one.

## Chunks (tick when done, then commit)
- [ ] 1. Install missing deps (googleapis nodemailer qrcode jose zod + @types, tsx dev); .env.example (GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY, SHEET_ID, GMAIL_USER, GMAIL_APP_PASSWORD, HOST_PASSWORD, AUTH_SECRET, FORM_TAB, FORM_URL); lib/validate.ts (login, accept, checkin, resend); lib/api.ts (ok, fail, zod-error helper); lib/types.ts
- [ ] 2. Data layer: if Member 3's files exist, only create lib/data.ts re-exporting them. Else mocks in lib/mocks/ (sample data: valid, duplicate email, invalid email, blank name, extra column, Accepted tab with one Checked In and one Not) + lib/data.ts. Mark assumed formStandard function names with ASSUMED comments.
- [ ] 3. Auth: lib/auth.ts, auth/login, auth/logout, middleware/proxy
- [ ] 4. lib/tickets.ts, lib/qr.ts, lib/mailer.ts, scripts/test-email.ts (run: npx tsx scripts/test-email.ts me@gmail.com)
- [ ] 5. GET /api/registrants, GET /api/accepted
- [ ] 6. POST /api/accept, POST /api/resend
- [ ] 7. POST /api/checkin
- [ ] 8. docs/API.md (examples per route) + README setup (env vars, Google service account, Gmail App Password)

## Notes from previous accounts (append below)