import nodemailer from 'nodemailer';

export interface SendTicketEmailParams {
  to: string;
  name: string;
  ticketId: string;
  qrBuffer: Buffer;
  eventTitle?: string;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function getMailerTransport() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    throw new Error('GMAIL_USER or GMAIL_APP_PASSWORD is not configured');
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user,
      pass,
    },
  });
}

/**
 * Sends a ticket confirmation email with inline QR code and Ticket ID.
 */
export async function sendTicketEmail({
  to,
  name,
  ticketId,
  qrBuffer,
  eventTitle = process.env.EVENT_NAME || 'Event Registration',
}: SendTicketEmailParams): Promise<{ success: boolean; error?: string }> {
  try {
    const transporter = getMailerTransport();
    const safeName = escapeHtml(name);
    const safeTicketId = escapeHtml(ticketId);

    const html = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
  <h2 style="color: #1a73e8; margin-top: 0;">${escapeHtml(eventTitle)} Ticket</h2>
  <p>Hello <strong>${safeName}</strong>,</p>
  <p>Your registration has been accepted! Please present this QR code at the check-in desk on the day of the event.</p>
  
  <div style="text-align: center; margin: 30px 0; padding: 20px; background-color: #f8f9fa; border-radius: 6px;">
    <div style="font-size: 14px; color: #5f6368; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Your Ticket ID</div>
    <div style="font-size: 24px; font-weight: bold; font-family: monospace; letter-spacing: 2px; color: #202124; margin-bottom: 20px;">${safeTicketId}</div>
    <img src="cid:qr" alt="Ticket QR Code" style="width: 220px; height: 220px; display: block; margin: 0 auto; border: 1px solid #dadce0; border-radius: 4px; padding: 6px; background: white;" />
  </div>

  <p style="color: #5f6368; font-size: 13px;">If the QR code does not display, you can provide your Ticket ID (<strong>${safeTicketId}</strong>) manually at the check-in counter.</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
  <p style="color: #9aa0a6; font-size: 12px; margin-bottom: 0;">This is an automated message. Please do not reply directly to this email.</p>
</div>`.trim();

    const text = `
Hello ${name},

Your registration for ${eventTitle} has been accepted!

Your Ticket ID is: ${ticketId}

Please present the attached QR code at the check-in desk on the day of the event, or provide your Ticket ID manually if requested.

This is an automated message.
`.trim();

    await transporter.sendMail({
      from: `"Event Registration" <${process.env.GMAIL_USER}>`,
      to,
      subject: `Your Ticket for ${eventTitle} - ${ticketId}`,
      text,
      html,
      attachments: [
        {
          filename: `ticket-${ticketId}.png`,
          content: qrBuffer,
          cid: 'qr',
        },
      ],
    });

    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: errorMsg };
  }
}
