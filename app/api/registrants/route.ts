import { ok, fail } from '@/lib/api';
import { requireHost } from '@/lib/auth';
import {
  loadResponses,
  checkHeaders,
  cleanRows,
  readTab,
  SheetsError,
  ACCEPTED_TAB,
} from '@/lib/data';

export async function GET(request: Request) {
  const denied = await requireHost(request);
  if (denied) return denied;

  try {
    const { headers, rows } = await loadResponses();
    const report = checkHeaders(headers, rows.slice(0, 50));

    if (!report.ready) {
      return fail(
        'Form check failed: standard titles are missing or duplicated',
        422,
        {
          missing: report.missing,
          duplicates: report.duplicates,
        }
      );
    }

    const acceptedRows = await readTab(ACCEPTED_TAB);
    const acceptedEmails = new Set<string>();

    for (let i = 1; i < acceptedRows.length; i++) {
      const email = acceptedRows[i][1];
      if (email) {
        acceptedEmails.add(email.trim().toLowerCase());
      }
    }

    const { registrants, skipped } = cleanRows(rows, report, { acceptedEmails });

    return ok({ registrants, skipped });
  } catch (err: unknown) {
    if (err instanceof SheetsError) {
      return fail(err.message, err.status);
    }
    const message = err instanceof Error ? err.message : String(err);
    return fail(`Failed to load registrants: ${message}`, 500);
  }
}
