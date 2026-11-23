/**
 * Google Sheets access (Sheets API v4, service account).
 *
 * Rules:
 *  - The responses tab (made by Google Forms) is READ ONLY. This file never writes to it.
 *  - Only the Accepted tab is written to.
 *  - All writes use RAW input so a name like "=SUM(1)" is stored as text, never as a formula,
 *    and phone numbers keep their leading zero.
 */
import { google } from "googleapis";

export const ACCEPTED_TAB = "Accepted";
export const DEFAULT_RESPONSES_TAB = "Form Responses 1";

/** Accepted tab column order. This is a shared contract (columns A to I). */
export const ACCEPTED_HEADERS = [
  "Ticket ID",
  "Email",
  "Full Name",
  "Organization",
  "Contact Number",
  "Accepted At",
  "Email Status",
  "Check-in Status",
  "Check-in Time",
] as const;

export type SheetsErrorCode =
  | "CONFIG"
  | "NOT_SHARED"
  | "SHEET_NOT_FOUND"
  | "TAB_NOT_FOUND"
  | "HEADER_MISMATCH"
  | "API";

export class SheetsError extends Error {
  constructor(
    public code: SheetsErrorCode,
    message: string,
    /** Suggested HTTP status for route handlers (kept within 404, 409, 500). */
    public status: number = 500,
  ) {
    super(message);
    this.name = "SheetsError";
  }
}

export interface Tab {
  title: string;
  sheetId: number;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

function client() {
  const email = process.env.GOOGLE_CLIENT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;
  const spreadsheetId = process.env.SHEET_ID;

  const missing = [
    !email && "GOOGLE_CLIENT_EMAIL",
    !rawKey && "GOOGLE_PRIVATE_KEY",
    !spreadsheetId && "SHEET_ID",
  ].filter(Boolean);
  if (missing.length) {
    throw new SheetsError("CONFIG", `Missing environment variable(s): ${missing.join(", ")}.`, 500);
  }

  const auth = new google.auth.JWT({
    email,
    key: rawKey!.replace(/\\n/g, "\n"), // Vercel stores the key with literal \n
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return { sheets: google.sheets({ version: "v4", auth }), spreadsheetId: spreadsheetId! };
}

/** Turn a googleapis error into a SheetsError with a message the host can act on. */
function wrap(e: unknown): SheetsError {
  if (e instanceof SheetsError) return e;
  const err = e as { code?: number | string; status?: number; message?: string; response?: { status?: number } };
  const status = Number(err?.code ?? err?.status ?? err?.response?.status);
  const msg = String(err?.message ?? "");

  if (status === 403) {
    return new SheetsError(
      "NOT_SHARED",
      "The app cannot open the sheet. Share the Google Sheet with the service account email as Editor.",
      500,
    );
  }
  if (status === 404) {
    return new SheetsError("SHEET_NOT_FOUND", "Sheet not found. Check the SHEET_ID environment variable.", 404);
  }
  if (status === 400 && /unable to parse range/i.test(msg)) {
    return new SheetsError("TAB_NOT_FOUND", "That tab does not exist in the sheet.", 404);
  }
  return new SheetsError("API", `Google Sheets error: ${msg || "unknown"}`, 500);
}

/** Quote a tab name for A1 notation: My Tab -> 'My Tab' */
const q = (tab: string) => `'${tab.replace(/'/g, "''")}'`;

// ---------------------------------------------------------------------------
// Basic operations
// ---------------------------------------------------------------------------

export async function getTabs(): Promise<Tab[]> {
  const { sheets, spreadsheetId } = client();
  try {
    const res = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: "sheets.properties(sheetId,title,index)",
    });
    return (res.data.sheets ?? []).map((s) => ({
      title: s.properties?.title ?? "",
      sheetId: s.properties?.sheetId ?? 0,
    }));
  } catch (e) {
    throw wrap(e);
  }
}

/** Read a whole tab (or a range such as "A1:I1") as strings. Rows can be shorter than the header. */
export async function readTab(tab: string, range = "A:ZZ"): Promise<string[][]> {
  const { sheets, spreadsheetId } = client();
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${q(tab)}!${range}`,
      valueRenderOption: "FORMATTED_VALUE",
    });
    return (res.data.values ?? []).map((r) => r.map((v) => String(v ?? "")));
  } catch (e) {
    throw wrap(e);
  }
}

/** Append rows under the last row of a tab. Returns the range that was written (for example "Accepted!A5:I6"). */
export async function appendRows(tab: string, rows: (string | number)[][]): Promise<string | undefined> {
  if (rows.length === 0) return undefined;
  const { sheets, spreadsheetId } = client();
  try {
    const res = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${q(tab)}!A1`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: rows },
    });
    return res.data.updates?.updatedRange ?? undefined;
  } catch (e) {
    throw wrap(e);
  }
}

/** Update one cell, for example updateCell("Accepted", "H5", "Checked In"). */
export async function updateCell(tab: string, a1: string, value: string | number): Promise<void> {
  const { sheets, spreadsheetId } = client();
  try {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${q(tab)}!${a1}`,
      valueInputOption: "RAW",
      requestBody: { values: [[value]] },
    });
  } catch (e) {
    throw wrap(e);
  }
}

// ---------------------------------------------------------------------------
// ensureTabs
// ---------------------------------------------------------------------------

/**
 * Make sure the Accepted tab exists with the right headers. Safe to call on every request.
 * Returns the current tab list.
 *
 * - Missing tab: created, headers written.
 * - Tab exists but row 1 is empty: headers written.
 * - Tab exists with different headers: HEADER_MISMATCH (the column order is a contract).
 */
export async function ensureTabs(): Promise<Tab[]> {
  let tabs = await getTabs();

  if (!tabs.some((t) => t.title === ACCEPTED_TAB)) {
    const { sheets, spreadsheetId } = client();
    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: ACCEPTED_TAB,
                  gridProperties: { frozenRowCount: 1 },
                },
              },
            },
          ],
        },
      });
    } catch (e) {
      // Two requests can race. If the tab now exists, carry on.
      const msg = String((e as { message?: string })?.message ?? "");
      if (!/already exists/i.test(msg)) throw wrap(e);
    }
    tabs = await getTabs();
  }

  const header = (await readTab(ACCEPTED_TAB, "A1:I1"))[0] ?? [];
  if (header.every((h) => !h.trim())) {
    const { sheets, spreadsheetId } = client();
    try {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${q(ACCEPTED_TAB)}!A1:I1`,
        valueInputOption: "RAW",
        requestBody: { values: [[...ACCEPTED_HEADERS]] },
      });
    } catch (e) {
      throw wrap(e);
    }
  } else {
    const same = ACCEPTED_HEADERS.every((h, i) => (header[i] ?? "").trim() === h);
    if (!same) {
      throw new SheetsError(
        "HEADER_MISMATCH",
        `The "${ACCEPTED_TAB}" tab headers were changed. Row 1 must be: ${ACCEPTED_HEADERS.join(", ")}.`,
        409,
      );
    }
  }

  return tabs;
}

// ---------------------------------------------------------------------------
// Finding and loading the form responses
// ---------------------------------------------------------------------------

/**
 * Pick the form responses tab.
 * 1. FORM_TAB environment variable (must exist)
 * 2. "Form Responses 1"
 * 3. the first tab whose name starts with "Form Responses" (Google names a relinked form "Form Responses 2")
 */
export function findResponsesTab(tabs: readonly Tab[], formTabEnv = process.env.FORM_TAB): string {
  const titles = tabs.map((t) => t.title);

  if (formTabEnv?.trim()) {
    const wanted = formTabEnv.trim();
    if (!titles.includes(wanted)) {
      throw new SheetsError("TAB_NOT_FOUND", `FORM_TAB is set to "${wanted}" but that tab does not exist.`, 404);
    }
    return wanted;
  }
  if (titles.includes(DEFAULT_RESPONSES_TAB)) return DEFAULT_RESPONSES_TAB;

  const guess = titles.find((t) => /^form responses/i.test(t));
  if (guess) return guess;

  throw new SheetsError(
    "TAB_NOT_FOUND",
    'No form responses tab found. In the form, open Responses > Link to Sheets, or set FORM_TAB to the tab name.',
    404,
  );
}

export interface LoadedResponses {
  tab: string;
  tabs: Tab[];
  /** Row 1 of the responses tab. */
  headers: string[];
  /** Data rows only, in sheet order (sheet row number = index + 2). */
  rows: string[][];
}

/** ensureTabs, find the responses tab, read it, split header and data. */
export async function loadResponses(): Promise<LoadedResponses> {
  const tabs = await ensureTabs();
  const tab = findResponsesTab(tabs);
  const all = await readTab(tab);
  return { tab, tabs, headers: all[0] ?? [], rows: all.slice(1) };
}
