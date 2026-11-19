import { ok, fail, failZod } from '@/lib/api';
import { requireHost } from '@/lib/auth';
import { checkinSchema } from '@/lib/validate';
import { readTab, updateCell } from '@/lib/data';

// In-memory lock per ticket to prevent concurrent check-in race conditions.
// Note: Google Sheets API does not offer native atomic compare-and-swap or row-level locking,
// so an in-memory lock is enforced at the server level in combination with a pre-update re-read.
const checkinLocks = new Set<string>();

export async function POST(request: Request) {
  const host = await requireHost(request);
  if (!host) {
    return fail('Unauthorized', 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail('Invalid JSON body', 400);
  }

  const parsed = checkinSchema.safeParse(body);
  if (!parsed.success) {
    return failZod(parsed.error);
  }

  const { ticketId } = parsed.data;

  if (checkinLocks.has(ticketId)) {
    return fail('Check-in already in progress for this ticket', 409);
  }

  checkinLocks.add(ticketId);

  try {
    // Re-read sheet immediately before updating to ensure freshest row state
    const rows = await readTab('Accepted');
    let targetIndex = -1;

    for (let i = 1; i < rows.length; i++) {
      if ((rows[i][0] ?? '').trim().toUpperCase() === ticketId) {
        targetIndex = i;
        break;
      }
    }

    if (targetIndex === -1) {
      return fail('Invalid ticket', 404);
    }

    const row = rows[targetIndex];
    const name = (row[2] ?? '').trim();
    const organization = (row[3] ?? '').trim();
    const currentStatus = (row[7] ?? '').trim();
    const existingCheckedInAt = (row[8] ?? '').trim();

    if (currentStatus === 'Checked In') {
      return fail('Already checked in', 409, {
        name,
        checkedInAt: existingCheckedInAt,
      });
    }

    const targetRowNum = targetIndex + 1;
    const nowIso = new Date().toISOString();

    // Update Col H (Check-in Status) and Col I (Check-in Time)
    await updateCell('Accepted', `H${targetRowNum}`, 'Checked In');
    await updateCell('Accepted', `I${targetRowNum}`, nowIso);

    return ok({
      name,
      organization,
      ticketId,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return fail(`Failed to process check-in: ${message}`, 500);
  } finally {
    checkinLocks.delete(ticketId);
  }
}
