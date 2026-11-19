import crypto from 'crypto';

const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/**
 * Generates a 10-character uppercase alphanumeric Ticket ID using Node crypto.
 */
export function generateTicketId(length = 10): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += CHARSET[crypto.randomInt(0, CHARSET.length)];
  }
  return result;
}
