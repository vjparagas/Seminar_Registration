import { ok, fail, failZod } from '@/lib/api';
import { requireHost } from '@/lib/auth';
import { resendSchema } from '@/lib/validate';
import { readTab, updateCell } from '@/lib/data';
import { generateQrBuffer } from '@/lib/qr';
import { sendTicketEmail } from '@/lib/mailer';
import { EmailStatus } from '@/lib/types';

export const runtime = 'nodejs';

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

  const parsed = resendSchema.safeParse(body);
  if (!parsed.success) {
    return failZod(parsed.error);
  }

  const { ticketId } = parsed.data;

  try {
    const rows = await readTab('Accepted');
    let targetRowIndex = -1;

    for (let i = 1; i < rows.length; i++) {
      if ((rows[i][0] ?? '').trim().toUpperCase() === ticketId) {
        targetRowIndex = i;
        break;
      }
    }

    if (targetRowIndex === -1) {
      return fail('Ticket not found', 404);
    }

    const row = rows[targetRowIndex];
    const email = (row[1] ?? '').trim();
    const name = (row[2] ?? '').trim();

    if (!email) {
      return fail('Attendee email missing on ticket', 400);
    }

    const qrBuffer = await generateQrBuffer(ticketId);
    const mailResult = await sendTicketEmail({
      to: email,
      name,
      ticketId,
      qrBuffer,
    });

    const targetRowNum = targetRowIndex + 1;

    if (!mailResult.success) {
      const reason = `Failed: ${mailResult.error || 'Unknown error'}`;
      await updateCell('Accepted', `G${targetRowNum}`, reason as EmailStatus);
      return fail(reason, 500);
    }

    await updateCell('Accepted', `G${targetRowNum}`, 'Sent' as EmailStatus);

    return ok({
      message: 'Ticket email resent successfully',
      ticketId,
      email,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return fail(`Failed to resend ticket: ${message}`, 500);
  }
}
