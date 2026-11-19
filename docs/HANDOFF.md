# Backend handoff (Member 2, API only)

Backend only. No UI, no pages, no styling. Do NOT edit lib/sheets.ts, lib/formStandard.ts, or create /api/sheet/check (Member 3 owns them).
Do not run the dev server or write extra tests. I test manually with curl.exe (Windows PowerShell). Replies: 5 lines max.
Do NOT poll or repeatedly check background tasks or installs. If an install seems stuck, stop and tell me to run it manually.

## Rules
- Next.js 16.4.6 App Router + TypeScript. Routes using googleapis/nodemailer: `export const runtime = 'nodejs'`.
- Responses: { ok: true, ... } or { ok: false, error, ...extra }. Status 400/401/404/409/422/500. Helpers ok, fail, failZod exist in lib/api.ts.
- Four standard titles come only from lib/formStandard.ts. Identity key = lowercase email. QR contains ONLY the Ticket ID.
- Data functions are imported only from lib/data.ts (mocks until Member 3 delivers). sheets: getTabs, readTab, appendRows, updateCell, ensureTabs.
- Every host handler calls requireHost(request). lib/auth.ts must be Edge-safe (no Node 'crypto').
- No secrets in code or logs.
- Next.js 16 deprecates middleware.ts. Use proxy.ts with `export function proxy(request)` and a config matcher for /dashboard/:path* and /api/:path*. Rules: /dashboard without session -> redirect /login; host API without session -> 401 JSON; /login and /api/auth/login public.
- Session: jose HS256, 8h, httpOnly cookie (secure in prod, sameSite lax).

## Contracts
- Accepted tab columns: A Ticket ID (10 uppercase A-Z0-9, Node crypto), B Email, C Full Name, D Organization, E Contact, F Accepted At (ISO), G Email Status ("Pending" / "Sent" / "Failed: reason"), H Check-in Status ("Not Checked In" / "Checked In"), I Check-in Time (ISO).
- Registrant: { email, name, organization, contact, timestamp, extra: Record<string,string> }. SkippedRow: { row, email?, reason }.
- GET /api/registrants: 422 { ok:false, error, missing, duplicates } if Form Check fails; else { ok:true, registrants (minus already accepted), skipped }.
- GET /api/accepted: { ok:true, accepted: AcceptedRow[], stats: { total, checkedIn } }.
- POST /api/accept { emails (1..20, lowercase) }: maxDuration 60; re-read sheet; process SEQUENTIALLY; recheck Accepted col B right before each append; in-memory in-flight Set; append row with status "Pending", make QR, send email, write G. Email failure does NOT roll back. Returns { ok:true, results:[{ email, status:'accepted'|'skipped'|'failed', ticketId?, emailStatus?, reason? }] }.
- POST /api/resend { ticketId }: 404 if not found; resend; update G; 500 + "Failed: reason" if send fails.
- POST /api/checkin { ticketId trimmed+uppercase }: 404 "Invalid ticket"; 409 "Already checked in" + name + checkedInAt; else set H, I and return { ok:true, name, organization, ticketId }. Re-read row before update + in-memory lock per ticket (Sheets has no atomic update; say so honestly).
- Email: Nodemailer Gmail SMTP, QR as inline CID attachment (<img src="cid:qr">), Ticket ID shown as text, HTML-escape name, plain-text alt.

## Chunks (tick when done, then commit)
- [x] 1. Install deps; .env.example; lib/validate.ts; lib/api.ts
- [x] 2. lib/types.ts (Registrant, SkippedRow, AcceptedRow, FormCheckResult). Data layer: if Member 3's lib/sheets.ts and lib/formStandard.ts exist, only create lib/data.ts re-exporting them. Else create mocks in lib/mocks/ (sample data: valid rows, duplicate email, invalid email, blank name, extra column, Accepted tab with one Checked In and one Not Checked In) plus lib/data.ts. Mark assumed formStandard function names with ASSUMED comments.
- [x] 3. Auth: lib/auth.ts, app/api/auth/login/route.ts, app/api/auth/logout/route.ts, proxy.ts
- [x] 4. lib/tickets.ts, lib/qr.ts, lib/mailer.ts, scripts/test-email.ts (run: npx tsx scripts/test-email.ts me@gmail.com)
- [x] 5. GET /api/registrants, GET /api/accepted
- [x] 6. POST /api/accept, POST /api/resend
- [x] 7. POST /api/checkin
- [x] 8. docs/API.md (examples per route) + README setup (env vars, Google service account, Gmail App Password)

## Notes from previous accounts (append below)
- Chunk 1 done. Next.js 16.4.6 confirmed: use proxy.ts, not middleware.ts.
- Chunk 2 done. Member 3 files not present; created lib/mocks/mockSheets.ts and lib/mocks/mockFormStandard.ts (with checkFormHeaders and cleanFormRows ASSUMED) and exposed via lib/data.ts.
- Chunk 3 done. Created Edge-safe lib/auth.ts with jose HS256, login and logout routes, and proxy.ts matching /dashboard/:path* and /api/:path*. Cookie name is 'host_session' (8h expiration).
- Chunk 4 done. Built 10-char uppercase ticket generator (crypto.randomInt), QR buffer generator (qrcode PNG), Nodemailer Gmail transporter with inline CID QR attachment and HTML-escaped attendee name, and scripts/test-email.ts loading .env.local.
- Chunk 5 done. Implemented GET /api/registrants (validates headers, excludes accepted, returns registrants & skipped) and GET /api/accepted (returns accepted list and stats: { total, checkedIn }).
- Chunk 6 done. Implemented POST /api/accept (sequential processing, in-flight Set, col B precheck, email dispatch, Col G write) and POST /api/resend (resends email with inline QR, updates Col G, 404/500 handling).
- Chunk 7 done. Implemented POST /api/checkin with 404 for invalid ticket, 409 for already checked in (with name + checkedInAt), Col H/I updates, pre-update re-read, and in-memory lock per ticket (noting Sheets lack of atomic operations). Omitted export const runtime per note.
- Chunk 8 done. Created docs/API.md with full request/response specs for all 7 routes, updated README.md with Google service account & Gmail setup, added EVENT_NAME env var, and performed architectural audit against ARCHITECTURE.md.- IMPORTANT: Do NOT add "export const runtime" to any route. It breaks with cacheComponents enabled in this project, and Node.js is the default. This overrides the Rules section above.
