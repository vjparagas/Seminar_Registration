/**
 * GET /api/sheet/check  (host only)
 *
 * Reads row 1 of the responses tab and checks it against the form standard.
 *
 * 200 { ok: true, ready, tab, tabs, fields, missing, duplicates, extras, warnings }
 *      ready=false means the form needs fixing (the dashboard shows the fix messages).
 * 4xx/5xx { ok: false, error, code } for real failures (sheet not shared, missing env, ...).
 *
 * Auth: middleware.ts protects this path, and the handler checks again with requireHost
 * (Member 2's lib/auth.ts). requireHost(req) must return a 401 Response when the cookie is
 * missing or invalid, and null when the host is signed in.
 */
import { requireHost } from "@/lib/auth";
import { checkHeaders } from "@/lib/formStandard";
import { loadResponses, SheetsError } from "@/lib/sheets";


export async function GET(req: Request) {
  const denied = await requireHost(req);
  if (denied) return denied;

  try {
    const { tab, tabs, headers, rows } = await loadResponses();
    const report = checkHeaders(headers, rows.slice(0, 50));
    return Response.json({ ok: true, tab, tabs: tabs.map((t) => t.title), ...report });
  } catch (e) {
    if (e instanceof SheetsError) {
      return Response.json({ ok: false, error: e.message, code: e.code }, { status: e.status });
    }
    console.error("sheet/check failed", e);
    return Response.json({ ok: false, error: "Unexpected error while reading the sheet." }, { status: 500 });
  }
}
