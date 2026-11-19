export interface Registrant {
  email: string;
  name: string;
  organization: string;
  contact: string;
  timestamp: string;
  extra: Record<string, string>;
}

export interface SkippedRow {
  row: number;
  email?: string;
  reason: string;
}

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

export interface FormCheckResult {
  ok: boolean;
  fields?: {
    name?: { status: string; column?: string };
    email?: { status: string; column?: string };
    organization?: { status: string; column?: string };
    contact?: { status: string; column?: string };
  };
  missing?: string[];
  duplicates?: string[];
  extras?: string[];
}
