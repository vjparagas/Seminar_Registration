import { ok, fail, failZod } from '@/lib/api';
import { requireHost } from '@/lib/auth';
import { acceptSchema } from '@/lib/validate';
import {
  loadResponses,
  checkHeaders,
  cleanRows,
  readTab,
  appendRows,
  updateCell,
  SheetsError,
  ACCEPTED_TAB,
} from '@/lib/data';
import { generateTicketId } from '@/lib/tickets';
import { generateQrBuffer } from '@/lib/qr';
import { sendTicketEmail } from '@/lib/mailer';
import { EmailStatus, Registrant } from '@/lib/types';

export const maxDuration = 60;

// Global in-memory set to prevent concurrent double-acceptance
const inFlightEmails = new Set<string>();

export interface AcceptResultItem {
  email: string;
  status: 'accepted' | 'skipped' | 'failed';
  ticketId?: string;
  emailStatus?: EmailStatus;
  reason?: string;
}

export async function POST(request: Request) {
  const denied = await requireHost(request);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail('Invalid JSON body', 400);
  }

  const parsed = acceptSchema.safeParse(body);
  if (!parsed.success) {
    return failZod(parsed.error);
  }

  const results: AcceptResultItem[] = [];

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

    // Read initial accepted emails to exclude from cleaned registrants
    const initialAccepted = await readTab(ACCEPTED_TAB);
    const initialAcceptedEmails = new Set<string>();
    for (let r = 1; r < initialAccepted.length; r++) {
      const accEmail = (initialAccepted[r][1] ?? '').trim().toLowerCase();
      if (accEmail) initialAcceptedEmails.add(accEmail);
    }

    const { registrants } = cleanRows(rows, report, { acceptedEmails: initialAcceptedEmails });
    const registrantMap = new Map<string, Registrant>();
    for (const reg of registrants) {
      registrantMap.set(reg.email, reg);
    }

    // Process sequentially as required
    for (const email of parsed.data.emails) {
      if (inFlightEmails.has(email)) {
        results.push({
          email,
          status: 'skipped',
          reason: 'Already being processed',
        });
        continue;
      }

      inFlightEmails.add(email);

      try {
        // Re-read Accepted right before checking and appending
        const acceptedRows = await readTab(ACCEPTED_TAB);
        let alreadyAccepted = false;

        for (let r = 1; r < acceptedRows.length; r++) {
          const accEmail = (acceptedRows[r][1] ?? '').trim().toLowerCase();
          if (accEmail === email) {
            alreadyAccepted = true;
            break;
          }
        }

        if (alreadyAccepted) {
          results.push({
            email,
            status: 'skipped',
            reason: 'Already accepted',
          });
          continue;
        }

        const registrant = registrantMap.get(email);
        if (!registrant) {
          results.push({
            email,
            status: 'skipped',
            reason: 'Not found in registrants',
          });
          continue;
        }

        const ticketId = generateTicketId();
        const acceptedAt = new Date().toISOString();
        const initialEmailStatus: EmailStatus = 'Pending';
        const initialCheckinStatus = 'Not Checked In';
        const checkinTime = '';

        const targetRowNum = acceptedRows.length + 1;

        const newRow = [
          ticketId,
          email,
          registrant.name,
          registrant.organization,
          registrant.contact,
          acceptedAt,
          initialEmailStatus,
          initialCheckinStatus,
          checkinTime,
        ];

        try {
          await appendRows(ACCEPTED_TAB, [newRow]);
        } catch (err: unknown) {
          const reason = err instanceof Error ? err.message : String(err);
          results.push({
            email,
            status: 'failed',
            reason: `Sheet write error: ${reason}`,
          });
          continue;
        }

        // Generate QR code and send email
        const qrBuffer = await generateQrBuffer(ticketId);
        const mailResult = await sendTicketEmail({
          to: email,
          name: registrant.name,
          ticketId,
          qrBuffer,
        });

        const finalEmailStatus: EmailStatus = mailResult.success
          ? 'Sent'
          : `Failed: ${mailResult.error || 'Unknown error'}`;

        // Write G column: Email Status
        await updateCell(ACCEPTED_TAB, `G${targetRowNum}`, finalEmailStatus);

        results.push({
          email,
          status: 'accepted',
          ticketId,
          emailStatus: finalEmailStatus,
        });
      } finally {
        inFlightEmails.delete(email);
      }
    }

    return ok({ results });
  } catch (err: unknown) {
    if (err instanceof SheetsError) {
      return fail(err.message, err.status);
    }
    const message = err instanceof Error ? err.message : String(err);
    return fail(`Failed to accept registrants: ${message}`, 500);
  }
}
