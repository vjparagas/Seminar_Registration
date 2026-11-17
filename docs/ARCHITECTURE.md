# Event Registration and QR Check-in System

System architecture, form standard, and team roles

Stack: Google Form + one Google Sheet, Next.js (App Router) on Vercel, Google Sheets API, Nodemailer (Gmail SMTP), qrcode, html5-qrcode. All free tier.

---

## 1. Overview

The host creates a Google Form from our standard template. Responses land in one Google Sheet. A web dashboard reads that sheet using the standard column names, shows the registered people with checkboxes, and the host ticks names and clicks Add. Accepted people are copied to an Accepted tab, given a Ticket ID, and emailed a QR code containing that Ticket ID. On event day the host scans the QR in the dashboard to mark attendance.

Design rules:

- The form follows a fixed standard (section 4). The app does not guess or detect columns. It looks up each standard column by its exact title.
- The app never writes to the form responses tab (Google Forms can shift or overwrite columns).
- Registered list = form rows minus people already in the Accepted tab.
- The identity key is the lowercase email address.
- Accepted data is a snapshot, so editing the form later cannot break an issued ticket.
- The QR contains only the Ticket ID.

---

## 2. System Architecture

```
                 Google Form (built from the standard template)
                            |
                            v
        +------------------ Google Sheet -------------------+
        |  [Form Responses 1]              [Accepted]       |
        |   (read only)                    (app writes)     |
        +--------------------------^------------------------+
                                   | Google Sheets API (service account)
                                   |
  +--------------------------------+---------------------------------+
  |  Next.js on Vercel (serverless)                                   |
  |                                                                   |
  |  LAYER 3: Data access     lib/sheets.ts, lib/formStandard.ts      |
  |  LAYER 2: Logic           lib/tickets.ts, lib/qr.ts,              |
  |                           lib/mailer.ts, lib/auth.ts              |
  |  LAYER 2: API             app/api/* route handlers + middleware   |
  |  LAYER 1: UI              /login, /dashboard (4 panels)           |
  +-----------+----------------------------------+--------------------+
              |                                  |
              v                                  v
     Gmail SMTP (Nodemailer)             Host phone/laptop camera
     sends ticket email with QR          (scanner tab, https)
```

| Layer | Responsibility | Technology |
|---|---|---|
| 1. Presentation | Login, Form Check, Registered, Accepted, Scanner | Next.js pages, React client components |
| 2. API and logic | Auth, accept, check-in, email, QR | Next.js Route Handlers, zod, jose |
| 3. Data | Read sheet by standard titles, write Accepted tab | googleapis (Sheets API v4) |
| 4. Messaging | Ticket email with embedded QR | Nodemailer + Gmail App Password |

---

## 3. Data Layer: One Sheet, Two Tabs

| Tab | Created by | Purpose |
|---|---|---|
| Form Responses 1 | Google Forms | Raw answers. Read only for the app. |
| Accepted | App (auto, ensureTabs) | Accepted people, Ticket IDs, check-in state |

If the responses tab has a different name, set the FORM_TAB environment variable.

How Google Forms maps to the sheet: every form question becomes a column header in row 1, and every submitted response becomes a new row below it. Column A is always the automatic Timestamp.

Accepted tab columns:

| Col | Field | Notes |
|---|---|---|
| A | Ticket ID | 10-char uppercase random, the only value in the QR |
| B | Email | lowercase, unique key |
| C | Full Name | snapshot at acceptance |
| D | Organization | snapshot |
| E | Contact Number | snapshot |
| F | Accepted At | timestamp |
| G | Email Status | Sent or Failed: reason |
| H | Check-in Status | Not Checked In or Checked In |
| I | Check-in Time | empty until checked in |

---

## 4. Google Form Standard (Column Names and Data)

Every form used with this system must contain these four questions with exactly these titles. The question title becomes the column header in the sheet, so the title is the contract.

| Column title (exact) | Question type | Required | Response validation | Data it contains | Example |
|---|---|---|---|---|---|
| Full Name | Short answer | Yes | none | Attendee's full name, one value. Letters, spaces, hyphens, apostrophes, periods. Max 100 characters. | Juan Dela Cruz |
| Email Address | Short answer | Yes | Text > Email | One valid email address. Used to send the ticket and as the unique key. | juan@email.com |
| Organization | Short answer | Yes | none | School, company, or group name. Max 100 characters. | ABC Corp |
| Contact Number | Short answer | Yes | Text > Regular expression: `^[0-9+\-\s()]{7,15}$` | Phone number, digits with optional +, spaces, dashes, parentheses. 7 to 15 characters. | 09171234567 |

Rules for the form:

1. Use the titles exactly as written. Matching ignores upper or lower case and extra spaces, but nothing else ("Name" or "Full name:" will not match).
2. Use Short answer for all four. Do not use multiple choice, dropdown, or paragraph for these.
3. Keep the four questions as the first four questions, in the order shown, so they are columns B to E. The app finds them by title, so order is not enforced, but this keeps the sheet easy to read.
4. Do not rename or delete these questions after the form is live.
5. Each title may appear only once in the form. A duplicate title makes the column ambiguous and blocks the dashboard.
6. Do not turn on "Collect email addresses" in Form settings. It creates a second column named "Email Address". Use the Email Address question instead.
7. Extra questions are allowed with any other titles (for example Dietary Needs or Year Level). They appear in the dashboard under "More details" and are never used for identification.
8. Do not insert, move, or edit columns in the responses tab of the sheet. Use the form to change questions.
9. Link the form: Responses > Link to Sheets > create a new spreadsheet. Share that spreadsheet with the service account email as Editor.

How the app cleans the data it reads:

| Field | Cleaning | Row is skipped when |
|---|---|---|
| Full Name | trim, collapse repeated spaces | empty |
| Email Address | trim, lowercase | empty, not a valid email, or a duplicate (earliest kept) |
| Organization | trim | never skipped, shown as empty |
| Contact Number | trim | never skipped, shown as empty |

Skipped rows are listed in the dashboard with the reason, for example "Row 14: email invalid".

### Form template
The team creates one template form that already follows this standard. The host opens the template and chooses Make a copy, then adds any extra questions. This is the easiest way to guarantee the titles are correct.

---

## 5. Form Check (simple header check, no detection)

There is no guessing and no scoring. The app only checks that the standard titles exist.

1. Read row 1 of the responses tab.
2. Normalize each header (trim, lowercase, collapse spaces) and look for the four standard titles.
3. Report:
   - found: title present once
   - missing: title not present
   - duplicate: title present more than once
   - extras: every other column (shown as "More details", Timestamp excluded)
4. If any of the four titles is missing or duplicated, the Registered tab is blocked and the host sees exactly what to fix.

Example messages:

```
Form check: ready
Full Name (column B)        OK
Email Address (column C)    OK
Organization (column D)     OK
Contact Number (column E)   OK
Extra questions: Dietary Needs, Year Level

Form check: action needed
Email Address: not found.
  Fix: add a Short answer question titled exactly "Email Address",
  required, with Response validation > Text > Email. Then press Re-check.
Contact Number: found twice (columns E and G).
  Fix: keep one question titled "Contact Number" and rename the other.
Tip: easiest fix is to make a fresh copy of the template form.
```

---

## 6. Project Structure

```
app/
  login/page.tsx
  dashboard/page.tsx            (Form Check, Registered, Accepted, Scanner)
  api/
    auth/login/route.ts
    auth/logout/route.ts
    sheet/check/route.ts
    registrants/route.ts
    accept/route.ts
    accepted/route.ts
    checkin/route.ts
    resend/route.ts
lib/
  formStandard.ts   standard titles (single source of truth), header lookup, row cleaning
  sheets.ts         getTabs, readTab, appendRows, updateCell, ensureTabs
  tickets.ts        Ticket ID generator
  qr.ts             QR PNG buffer from Ticket ID
  mailer.ts         Nodemailer transport and email template
  auth.ts           sign and verify session cookie (jose)
  validate.ts       zod schemas
middleware.ts       protects /dashboard and host API routes
```

lib/formStandard.ts holds the four standard titles as constants. Every other module imports them, so a title is never typed in two places.

---

## 7. Dashboard Modules

- Login: host password, sets a signed httpOnly cookie.
- Form Check panel: OK or missing badge per standard title, fix messages, Re-check button, link to the template form.
- Tab 1 Registered (only when Form Check is OK): checkbox per row, select all, "Add N to Accepted", search, expandable "More details", list of skipped rows with reasons.
- Tab 2 Accepted: list, email status, check-in status, counts, search, Resend email button.
- Tab 3 Scanner: camera, green or red result panel, manual Ticket ID box, 2-second scan lock.

---

## 8. API Endpoints

All responses are JSON: `{ ok: true, ... }` or `{ ok: false, error }` with status 400, 401, 404, 409, 422, or 500. All host endpoints are protected by middleware and by a cookie check inside each handler.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | /api/auth/login | public | `{ password }` sets session cookie |
| POST | /api/auth/logout | host | clears cookie |
| GET | /api/sheet/check | host | runs ensureTabs, reads row 1, returns `{ ok, fields: { name, email, organization, contact: { status, column } }, missing, duplicates, extras }` |
| GET | /api/registrants | host | cleaned list minus accepted, duplicates removed (earliest kept), bad rows in `skipped`. 422 if the Form Check fails |
| POST | /api/accept | host | `{ emails: [...] }` re-reads sheet, skips already accepted, creates Ticket ID, appends to Accepted, generates QR, sends email, writes Email Status |
| GET | /api/accepted | host | accepted list and `stats: { total, checkedIn }` |
| POST | /api/checkin | host | `{ ticketId }` marks Checked In. 404 Invalid ticket, 409 Already checked in |
| POST | /api/resend | host | `{ ticketId }` resends email |

Registrant object: `{ email, name, organization, contact, timestamp, extra: { "Question": "Answer" } }`.

---

## 9. Integration Points

| ID | From | To | Data |
|---|---|---|---|
| IP1 | Form Check panel | /api/sheet/check | check result per standard title |
| IP2 | Registered tab | /api/registrants | cleaned registrant list |
| IP3 | Registered tab | /api/accept | selected emails |
| IP4 | Accepted tab | /api/accepted | accepted list, stats |
| IP5 | Scanner tab | /api/checkin | scanned Ticket ID |
| IP6 | Route handlers | Google Sheets API | read and write rows, create Accepted tab |
| IP7 | /api/accept | qrcode library | Ticket ID in, PNG out |
| IP8 | /api/accept | Gmail SMTP (Nodemailer) | recipient, HTML, QR attachment |
| IP9 | Scanner tab | device camera | video in, Ticket ID text out |
| IP10 | Google Form | Google Sheet | automatic, by Google |

Key contract: the QR contains only the Ticket ID. The scanner sends that text to /api/checkin, and the server looks it up in column A of the Accepted tab.

---

## 10. Sequence Flows

Connect and view list

1. Host logs in and opens the dashboard.
2. Dashboard calls /api/sheet/check.
3. Server runs ensureTabs, reads row 1, and compares it to the standard titles.
4. If ready, Tab 1 loads from /api/registrants. If not, the Form Check panel shows what to fix and the host corrects the form, then presses Re-check.

Accept

1. Host ticks names and clicks Add.
2. /api/accept re-reads the sheet (never trusts the browser copy).
3. For each email not yet accepted: create the Accepted row, generate the QR, send the email, record Email Status.
4. Dashboard moves those people to the Accepted tab.

Check-in

1. Host scans the QR (contains only the Ticket ID).
2. /api/checkin finds it in column A of Accepted.
3. Returns Checked In, Already checked in (409), or Invalid ticket (404).
4. Screen shows green with the name, or red with the reason.

---

## 11. Edge Cases

| Situation | Behavior |
|---|---|
| A standard title is missing or misspelled | Registered tab blocked, Form Check names the exact title to add |
| A standard title appears twice | Registered tab blocked, host told which columns clash |
| "Collect email addresses" turned on | Duplicate "Email Address" column, blocked with the fix message |
| Host adds extra questions | Appear under "More details" |
| Same email submitted twice | Shown once (earliest), duplicate listed in skipped |
| Invalid or empty email | Row skipped with reason |
| Name blank for a row | Row skipped, reason "name missing" |
| Person already accepted | Hidden from Registered, cannot be accepted twice |
| Row deleted from responses tab | No effect, accepted data is a snapshot |
| Form edited after accepting | Accepted tickets unaffected |
| Sheet not shared with service account | Error: share the Sheet with the service account email as Editor |
| Responses tab not named Form Responses 1 | Set FORM_TAB |

---

## 12. Setup and Environment Variables

1. Make a copy of the template form (or build a form that follows section 4).
2. Responses > Link to Sheets > create a new spreadsheet (your one sheet).
3. Google Cloud Console: create a project, enable Google Sheets API, create a service account, download the JSON key.
4. Share the spreadsheet with the service account email as Editor.
5. Gmail: turn on 2-step verification, create an App Password.
6. Push the Next.js project to GitHub, import into Vercel, add the variables below, deploy.

| Variable | Purpose |
|---|---|
| GOOGLE_CLIENT_EMAIL | service account email |
| GOOGLE_PRIVATE_KEY | service account key (keep the \n line breaks) |
| SHEET_ID | ID from the Sheet URL |
| GMAIL_USER | sender Gmail address |
| GMAIL_APP_PASSWORD | Gmail App Password |
| HOST_PASSWORD | dashboard password |
| AUTH_SECRET | long random string for signing the cookie |
| FORM_TAB (optional) | responses tab name if it is not "Form Responses 1" |
| FORM_URL (optional) | shows the template or form link in the dashboard |

Only the Google Sheets API is needed, not the Forms API.

---

## 13. Team Roles (4 Members)

### Member 1: Frontend
- Build the /login page and the /dashboard layout with tabs
- Form Check panel: OK or missing badge per standard title, fix messages, Re-check button, link to the template form
- Registered tab: checkbox per row, select all, "Add N to Accepted" button, search, "More details" row, skipped rows list, loading and result messages
- Accepted tab: list, email status, check-in status, counts, search, Resend button
- Scanner tab: camera view (html5-qrcode), green or red result panel, manual Ticket ID box, 2-second scan lock
- Styling, loading states, and error messages
- Calls the API endpoints only, never the Google Sheet directly
- Done when: the host can log in, see the form check, tick names, click Add, view Accepted, and scan from the UI

### Member 2: API
- Build the route handlers: /api/auth/login, /api/auth/logout, /api/registrants, /api/accept, /api/accepted, /api/checkin, /api/resend
- Build lib/tickets.ts, lib/qr.ts, lib/mailer.ts, lib/auth.ts, lib/validate.ts, and middleware.ts
- Handle duplicates, already-accepted people, and the Already checked in and Invalid ticket cases
- Set up the Google Cloud service account and the Gmail App Password
- Reads people through the cleaned rows from Member 3's lib/formStandard.ts
- Done when: accepting people creates Accepted rows and sends emails with a readable QR, and check-in returns the right result

### Member 3: Form Standard and Sheet Data
- Own the standard in section 4: finalize the titles, question types, validation, and the example data
- Build the template Google Form that follows the standard, and a one-page host guide
- Build lib/formStandard.ts (title constants, exact header lookup, row cleaning, skipped-row reasons)
- Build lib/sheets.ts (getTabs, readTab, appendRows, updateCell, ensureTabs) and /api/sheet/check
- Write unit tests with sample sheets: correct headers, missing title, misspelled title, duplicate title, extra questions, invalid email, duplicate email
- Done when: the template form passes the Form Check, and every bad case gives a clear fix message

### Member 4: Deployment and Testing
- Create the Google Sheet linked to the template form, and share it with the service account
- Push the project to GitHub, deploy to Vercel, and configure the environment variables
- Run the end-to-end test checklist (section 14) with 3 to 5 real people
- Test edge cases: duplicate emails, renamed or deleted questions, wrong password, same QR scanned twice, fake Ticket ID
- Test the scanner on a phone over https
- Prepare the demo and screenshots
- Done when: the full flow works on the deployed site from a phone, start to finish

### Shared Contracts (everyone must follow)
- The four standard titles live only in lib/formStandard.ts: Full Name, Email Address, Organization, Contact Number
- Accepted tab column order (A to I above)
- Endpoint paths and the `{ ok, error }` response shape
- The /api/sheet/check response shape (Member 1 and Member 3 agree on this first)
- The QR contains only the Ticket ID

### Who Depends on Whom
- Frontend needs the endpoint paths and response shapes from API and Member 3 (use mock data until they are ready)
- API needs lib/sheets.ts and lib/formStandard.ts from Member 3
- Member 3 needs the sheet and service account from Member 4 for real tests, but can start with sample data
- Member 4 can set up the sheet, Google Cloud, and Vercel right away, then test as pieces arrive

---

## 14. End-to-End Test Checklist

- Template form copy: Form Check shows all four titles OK
- Misspell a title (for example "Email"): blocked, message names the exact title to use
- Delete the Email Address question: blocked with the fix message
- Add a second "Contact Number" question: blocked, duplicate reported
- Turn on "Collect email addresses": blocked as duplicate Email Address
- Add three extra questions: appear under "More details"
- Submit the same email twice: shown once, duplicate in skipped
- Submit an invalid email through the sheet: row skipped with reason
- Accept 2 people: 2 rows in Accepted, 2 emails with QR arrive
- Edit the form after accepting: accepted tickets unaffected
- Scan QR: Checked In. Scan again: Already checked in. Fake ID: Invalid ticket
- Open /dashboard without logging in: redirected to /login

---

## 15. Limits

- The form must follow the standard titles. A form that does not follow it is blocked until fixed, which keeps the logic simple and predictable
- Email is mandatory because it is the unique key and delivery address
- Gmail SMTP allows about 500 emails per day, far above prototype needs
- Sheets API has per-minute quotas, so accept in batches of 10 to 20
- Vercel functions have a time limit, so set maxDuration on the accept route
- Service account only has access to this one spreadsheet
- Form answers are personal data: dashboard is password protected and keys live only in Vercel environment variables
- Camera scanning requires https, which Vercel provides
