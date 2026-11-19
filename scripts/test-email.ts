import fs from 'fs';
import path from 'path';
import { generateTicketId } from '../lib/tickets';
import { generateQrBuffer } from '../lib/qr';
import { sendTicketEmail } from '../lib/mailer';

// Load .env.local (and fallback to .env)
function loadEnvFile(fileName: string) {
  const filePath = path.resolve(process.cwd(), fileName);
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, 'utf-8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();

      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      val = val.replace(/\\n/g, '\n');

      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

loadEnvFile('.env.local');
loadEnvFile('.env');

async function main() {
  const targetEmail = process.argv[2];

  if (!targetEmail) {
    console.error('Usage: npx tsx scripts/test-email.ts <your-email@example.com>');
    process.exit(1);
  }

  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.error('Error: GMAIL_USER and GMAIL_APP_PASSWORD must be configured in .env.local');
    process.exit(1);
  }

  console.log(`Generating test ticket and QR code...`);
  const ticketId = generateTicketId();
  const qrBuffer = await generateQrBuffer(ticketId);

  console.log(`Sending test ticket email to ${targetEmail} (Ticket ID: ${ticketId})...`);
  const result = await sendTicketEmail({
    to: targetEmail,
    name: 'Test Attendee',
    ticketId,
    qrBuffer,
    eventTitle: 'Test Seminar 2026',
  });

  if (result.success) {
    console.log(`Email sent successfully! Check your inbox at ${targetEmail}.`);
  } else {
    console.error(`Failed to send email: ${result.error}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
