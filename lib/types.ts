export type { Registrant, SkippedRow, FormCheckReport } from './formStandard';

export type EmailStatus = 'Pending' | 'Sent' | `Failed: ${string}`;
export type CheckinStatus = 'Not Checked In' | 'Checked In';

export interface AcceptedRow {
  ticketId: string;
  email: string;
  name: string;
  organization: string;
  contact: string;
  acceptedAt: string;
  emailStatus: EmailStatus;
  checkinStatus: CheckinStatus;
  checkinTime: string;
}
