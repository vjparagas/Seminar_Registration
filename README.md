# Event Registration and QR Check-in System

Backend API and registration management service built on Next.js 16 (App Router), Google Sheets API, and Nodemailer (Gmail SMTP).

---

## 1. Environment Variables

Create a `.env.local` file in the root directory based on `.env.example`:

| Variable | Required | Description | Example / Notes |
|---|---|---|---|
| `GOOGLE_CLIENT_EMAIL` | Yes | Service account email | `sa@project.iam.gserviceaccount.com` |
| `GOOGLE_PRIVATE_KEY` | Yes | Service account private key | `"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"` (preserve `\n` line breaks) |
| `SHEET_ID` | Yes | Google Spreadsheet ID | Extracted from the spreadsheet URL: `/spreadsheets/d/<SHEET_ID>/edit` |
| `GMAIL_USER` | Yes | Sender Gmail address | `your-email@gmail.com` |
| `GMAIL_APP_PASSWORD` | Yes | 16-character Gmail App Password | Generated from Google Account security settings |
| `HOST_PASSWORD` | Yes | Host dashboard access password | Secure secret string for dashboard authentication |
| `AUTH_SECRET` | Yes | JWT session signing key | Random 32+ character string for HS256 tokens |
| `EVENT_NAME` | Optional | Event title for emails | Defaults to `"Event Registration"` |
| `FORM_TAB` | Optional | Sheet tab name for responses | Defaults to `"Form Responses 1"` |
| `FORM_URL` | Optional | Public link to Google Form | Displayed in dashboard for quick access |

---

## 2. Google Service Account Setup

1. **Google Cloud Console**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/) and create a new project (or select an existing one).
2. **Enable Google Sheets API**:
   - Navigate to **APIs & Services > Library**.
   - Search for **Google Sheets API** and click **Enable** (the Google Forms API is NOT required).
3. **Create Service Account**:
   - Navigate to **APIs & Services > Credentials**.
   - Click **Create Credentials > Service Account**.
   - Enter a name (e.g. `event-sheets-service`) and click **Create and Continue**, then click **Done**.
4. **Generate JSON Key**:
   - Select the newly created service account from the list.
   - Go to the **Keys** tab, click **Add Key > Create new key**, choose **JSON**, and click **Create**.
   - Save the downloaded JSON file securely.
5. **Configure Environment Variables**:
   - Copy `client_email` from the JSON key file into `GOOGLE_CLIENT_EMAIL`.
   - Copy `private_key` from the JSON key file into `GOOGLE_PRIVATE_KEY` (make sure quotes enclose the string so that literal `\n` line breaks are preserved).
6. **Share Google Sheet**:
   - Open your Google Sheet linked to the Google Form.
   - Click the **Share** button in the top right.
   - Add the service account email (`GOOGLE_CLIENT_EMAIL`) with **Editor** permissions so the backend can append and update the `Accepted` tab.

---

## 3. Gmail App Password Setup

1. Open your Google Account at [myaccount.google.com](https://myaccount.google.com/).
2. Go to **Security** and ensure **2-Step Verification** is enabled.
3. In the search bar at the top, search for **App passwords**.
4. Enter an app name (e.g., `Event QR Registration`) and click **Create**.
5. Copy the generated 16-character password into `GMAIL_APP_PASSWORD` in your `.env.local` file (without spaces), and set `GMAIL_USER` to your Gmail address.

---

## 4. Architecture & Runtime Note

- **Next.js 16 Proxy Convention**: Next.js 16 deprecates `middleware.ts` in favor of `proxy.ts`. Route protection for `/dashboard/:path*` and `/api/:path*` is enforced via `proxy.ts` at the edge and verified within each route handler via `requireHost()`.
- **Runtime Exports**: Route handlers do **not** export `export const runtime = 'nodejs'`. In Next.js 16 with `cacheComponents` enabled, route-level runtime exports can cause build-time conflicts; Node.js is already the default runtime for Next.js App Router route handlers.

---

## 5. API Documentation

Complete documentation of all 7 endpoints, request formats, and real sample responses can be found in [docs/API.md](docs/API.md).
