import { ok, fail, failZod } from '@/lib/api';
import { requireHost } from '@/lib/auth';
import { acceptSchema } from '@/lib/validate';
import { readTab, appendRows, updateCell, FULL_NAME, EMAIL_ADDRESS, ORGANIZATION, CONTACT_NUMBER } from '@/lib/data';
import { generateTicketId } from '@/lib/tickets';
import { generateQrBuffer } from '@/lib/qr';
import { sendTicketEmail } from '@/lib/mailer';
import { EmailStatus } from '@/lib/types';

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

  const parsed = acceptSchema.safeParse(body);
  if (!parsed.success) {
    return failZod(parsed.error);
  }

  const results: AcceptResultItem[] = [];

  try {
    const formTab = process.env.FORM_TAB || 'Form Responses 1';
    const formRows = await readTab(formTab);

    if (formRows.length < 2) {
      return fail('No responses found in sheet', 400);
    }

    const headers = formRows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, ' '));
    const nameCol = headers.indexOf(FULL_NAME.toLowerCase());
    const emailCol = headers.indexOf(EMAIL_ADDRESS.toLowerCase());
    const orgCol = headers.indexOf(ORGANIZATION.toLowerCase());
    const contactCol = headers.indexOf(CONTACT_NUMBER.toLowerCase());

    if (nameCol < 0 || emailCol < 0) {
      return fail('Standard form columns missing in responses sheet', 422);
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
        const acceptedRows = await readTab('Accepted');
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

        // Find earliest matching valid response for this email
        let registrantData: { name: string; org: string; contact: string } | null = null;

        for (let r = 1; r < formRows.length; r++) {
          const row = formRows[r];
          const rowEmail = (row[emailCol] ?? '').trim().toLowerCase();
          if (rowEmail === email) {
            const rawName = (row[nameCol] ?? '').trim();
            if (rawName) {
              registrantData = {
                name: rawName,
                org: orgCol >= 0 ? (row[orgCol] ?? '').trim() : '',
                contact: contactCol >= 0 ? (row[contactCol] ?? '').trim() : '',
              };
              break;
            }
          }
        }

        if (!registrantData) {
          results.push({
            email,
            status: 'failed',
            reason: 'Registrant with valid name not found in form responses',
          });
          continue;
        }

        const ticketId = generateTicketId();
        const acceptedAt = new Date().toISOString();
        const initialEmailStatus: EmailStatus = 'Pending';
        const initialCheckinStatus = 'Not Checked In';
        const checkinTime = '';

        // Row position: acceptedRows has acceptedRows.length rows before this append.
        // Google Sheets row number for newly appended row is (acceptedRows.length + 1)
        const targetRowNum = acceptedRows.length + 1;

        const newRow = [
          ticketId,
          email,
          registrantData.name,
          registrantData.org,
          registrantData.contact,
          acceptedAt,
          initialEmailStatus,
          initialCheckinStatus,
          checkinTime,
        ];

        await appendRows('Accepted', [newRow]);

        // Generate QR code and send email
        const qrBuffer = await generateQrBuffer(ticketId);
        const mailResult = await sendTicketEmail({
          to: email,
          name: registrantData.name,
          ticketId,
          qrBuffer,
        });

        const finalEmailStatus: EmailStatus = mailResult.success
          ? 'Sent'
          : `Failed: ${mailResult.error || 'Unknown error'}`;

        // Write G column: Email Status
        await updateCell('Accepted', `G${targetRowNum}`, finalEmailStatus);

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
    const message = err instanceof Error ? err.message : String(err);
    return fail(`Failed to accept registrants: ${message}`, 500);
  }
}
