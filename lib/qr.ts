import QRCode from 'qrcode';

/**
 * Generates a PNG Buffer containing ONLY the Ticket ID.
 */
export async function generateQrBuffer(ticketId: string): Promise<Buffer> {
  return await QRCode.toBuffer(ticketId, {
    type: 'png',
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 300,
  });
}
