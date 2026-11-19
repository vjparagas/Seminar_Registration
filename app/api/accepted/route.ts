import { ok, fail } from '@/lib/api';
import { requireHost } from '@/lib/auth';
import { ensureTabs, readTab } from '@/lib/data';
import { AcceptedRow, EmailStatus, CheckinStatus } from '@/lib/types';


export async function GET(request: Request) {
  const host = await requireHost(request);
  if (!host) {
    return fail('Unauthorized', 401);
  }

  try {
    await ensureTabs();

    const rows = await readTab('Accepted');
    const accepted: AcceptedRow[] = [];

    // Row 0 is header: [Ticket ID, Email, Full Name, Organization, Contact Number, Accepted At, Email Status, Check-in Status, Check-in Time]
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const ticketId = (row[0] ?? '').trim();
      const email = (row[1] ?? '').trim().toLowerCase();

      if (!ticketId && !email) {
        continue;
      }

      const name = (row[2] ?? '').trim();
      const organization = (row[3] ?? '').trim();
      const contact = (row[4] ?? '').trim();
      const acceptedAt = (row[5] ?? '').trim();
      const emailStatus = ((row[6] ?? 'Pending').trim() as EmailStatus);
      const checkinStatus = ((row[7] ?? 'Not Checked In').trim() as CheckinStatus);
      const checkinTime = (row[8] ?? '').trim();

      accepted.push({
        ticketId,
        email,
        name,
        organization,
        contact,
        acceptedAt,
        emailStatus,
        checkinStatus,
        checkinTime,
      });
    }

    const total = accepted.length;
    const checkedIn = accepted.filter(
      (r) => r.checkinStatus === 'Checked In'
    ).length;

    return ok({
      accepted,
      stats: {
        total,
        checkedIn,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return fail(`Failed to load accepted list: ${message}`, 500);
  }
}
