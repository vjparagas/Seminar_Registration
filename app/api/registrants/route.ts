import { ok, fail } from '@/lib/api';
import { requireHost } from '@/lib/auth';
import {
  ensureTabs,
  readTab,
  checkFormHeaders,
  cleanFormRows,
} from '@/lib/data';


export async function GET(request: Request) {
  const host = await requireHost(request);
  if (!host) {
    return fail('Unauthorized', 401);
  }

  try {
    await ensureTabs();

    const formTab = process.env.FORM_TAB || 'Form Responses 1';
    const formRows = await readTab(formTab);

    if (formRows.length === 0) {
      return fail('Responses tab is empty', 422, {
        missing: ['Full Name', 'Email Address', 'Organization', 'Contact Number'],
      });
    }

    const headers = formRows[0] || [];
    const formCheck = checkFormHeaders(headers);

    if (!formCheck.ok) {
      return fail(
        'Form check failed: standard titles are missing or duplicated',
        422,
        {
          missing: formCheck.missing,
          duplicates: formCheck.duplicates,
        }
      );
    }

    const acceptedRows = await readTab('Accepted');
    const acceptedEmails = new Set<string>();

    for (let i = 1; i < acceptedRows.length; i++) {
      const email = acceptedRows[i][1];
      if (email) {
        acceptedEmails.add(email.trim().toLowerCase());
      }
    }

    const { registrants, skipped } = cleanFormRows(formRows, acceptedEmails);

    return ok({ registrants, skipped });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return fail(`Failed to load registrants: ${message}`, 500);
  }
}
