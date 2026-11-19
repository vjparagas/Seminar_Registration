// Frontend API client for the dashboard.
// Matches the contracts in docs/HANDOFF.md.
//
// USE_MOCK = true  -> everything runs on fake in-memory data (no backend needed).
// USE_MOCK = false -> real fetch calls to the /api routes.
//
// Property names of the accepted row are ASSUMED (the backend's lib/types.ts
// AcceptedRow does not exist yet). If they differ, change UiAccepted and
// mapAccepted() below, nothing else.

export const USE_MOCK = true;

export type UiRegistrant = {
  email: string;
  name: string;
  organization: string;
  contact: string;
  timestamp: string;
  extra: Record<string, string>;
};

export type UiSkipped = { row: number; email?: string; reason: string };

export type UiAccepted = {
  ticketId: string;
  email: string;
  name: string;
  organization: string;
  contact: string;
  acceptedAt: string;
  emailStatus: string; // "Pending" | "Sent" | "Failed: reason"
  checkInStatus: string; // "Not Checked In" | "Checked In"
  checkInTime: string; // ISO or ""
};

export type AcceptResult = {
  email: string;
  status: "accepted" | "skipped" | "failed";
  ticketId?: string;
  emailStatus?: string;
  reason?: string;
};

export type Failure = {
  ok: false;
  error: string;
  status: number;
  missing?: string[];
  duplicates?: string[];
};

export type RegistrantsResponse =
  | { ok: true; registrants: UiRegistrant[]; skipped: UiSkipped[] }
  | Failure;

export type AcceptedResponse =
  | {
      ok: true;
      accepted: UiAccepted[];
      stats: { total: number; checkedIn: number };
    }
  | Failure;

export type AcceptResponse =
  | { ok: true; results: AcceptResult[] }
  | Failure;

export type ResendResponse = { ok: true } | Failure;

export type CheckinResponse =
  | { ok: true; name: string; organization: string; ticketId: string }
  | (Failure & { name?: string; checkedInAt?: string });

export type LoginResponse = { ok: true } | Failure;

// ---------------------------------------------------------------- real API

async function call<T>(
  url: string,
  method: "GET" | "POST",
  body?: unknown
): Promise<T> {
  try {
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && !url.includes("/api/auth/login")) {
      // Session expired -> back to login.
      window.location.assign("/login");
    }
    return { ...data, ok: res.ok && data.ok !== false, status: res.status } as T;
  } catch {
    return {
      ok: false,
      error: "Cannot reach the server. Check your connection.",
      status: 0,
    } as T;
  }
}

// ---------------------------------------------------------------- mock API

const wait = (ms = 300) => new Promise((r) => setTimeout(r, ms));

const mockState = {
  registrants: [
    { email: "juan@email.com", name: "Juan Dela Cruz", organization: "PUP", contact: "09171234567", timestamp: "2026-11-10T08:00:00.000Z", extra: {} },
    { email: "maria@email.com", name: "Maria Santos", organization: "ABC Corp", contact: "09181234567", timestamp: "2026-11-10T09:30:00.000Z", extra: {} },
    { email: "pedro@email.com", name: "Pedro Reyes", organization: "XYZ Inc", contact: "09191234567", timestamp: "2026-11-11T10:15:00.000Z", extra: {} },
    { email: "ana@email.com", name: "Ana Lopez", organization: "PUP", contact: "09201234567", timestamp: "2026-11-12T11:00:00.000Z", extra: {} },
    { email: "carlo@email.com", name: "Carlo Mendoza", organization: "Freelancer", contact: "09211234567", timestamp: "2026-11-13T13:45:00.000Z", extra: {} },
  ] as UiRegistrant[],
  skipped: [
    { row: 7, email: "not-an-email", reason: "Invalid email" },
    { row: 9, reason: "Blank name" },
  ] as UiSkipped[],
  accepted: [
    { ticketId: "A1B2C3D4E5", email: "liza@email.com", name: "Liza Garcia", organization: "PUP", contact: "09221234567", acceptedAt: "2026-11-14T08:00:00.000Z", emailStatus: "Sent", checkInStatus: "Not Checked In", checkInTime: "" },
    { ticketId: "F6G7H8I9J0", email: "mark@email.com", name: "Mark Tan", organization: "ABC Corp", contact: "09231234567", acceptedAt: "2026-11-14T08:05:00.000Z", emailStatus: "Failed: SMTP timeout", checkInStatus: "Checked In", checkInTime: "2026-11-18T01:15:00.000Z" },
  ] as UiAccepted[],
};

function mockTicketId() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let id = "";
  for (let i = 0; i < 10; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

function mockStats() {
  const list = mockState.accepted;
  return {
    total: list.length,
    checkedIn: list.filter((a) => a.checkInStatus === "Checked In").length,
  };
}

// ------------------------------------------------------------ public client

export async function login(password: string): Promise<LoginResponse> {
  if (USE_MOCK) {
    await wait();
    if (password.trim() === "") {
      return { ok: false, error: "Password is required", status: 400 };
    }
    return { ok: true };
  }
  return call<LoginResponse>("/api/auth/login", "POST", { password });
}

export async function logout(): Promise<void> {
  if (USE_MOCK) return;
  await call("/api/auth/logout", "POST", {});
}

export async function getRegistrants(): Promise<RegistrantsResponse> {
  if (USE_MOCK) {
    await wait();
    return {
      ok: true,
      registrants: [...mockState.registrants],
      skipped: [...mockState.skipped],
    };
  }
  return call<RegistrantsResponse>("/api/registrants", "GET");
}

export async function getAccepted(): Promise<AcceptedResponse> {
  if (USE_MOCK) {
    await wait();
    return { ok: true, accepted: [...mockState.accepted], stats: mockStats() };
  }
  return call<AcceptedResponse>("/api/accepted", "GET");
}

export async function acceptEmails(emails: string[]): Promise<AcceptResponse> {
  if (USE_MOCK) {
    await wait(700);
    const results: AcceptResult[] = emails.map((email) => {
      const person = mockState.registrants.find((r) => r.email === email);
      if (!person) return { email, status: "skipped", reason: "Already accepted" };
      const ticketId = mockTicketId();
      mockState.accepted.push({
        ticketId,
        email: person.email,
        name: person.name,
        organization: person.organization,
        contact: person.contact,
        acceptedAt: new Date().toISOString(),
        emailStatus: "Sent",
        checkInStatus: "Not Checked In",
        checkInTime: "",
      });
      mockState.registrants = mockState.registrants.filter((r) => r.email !== email);
      return { email, status: "accepted", ticketId, emailStatus: "Sent" };
    });
    return { ok: true, results };
  }
  return call<AcceptResponse>("/api/accept", "POST", { emails });
}

export async function resendEmail(ticketId: string): Promise<ResendResponse> {
  if (USE_MOCK) {
    await wait();
    const row = mockState.accepted.find((a) => a.ticketId === ticketId);
    if (!row) return { ok: false, error: "Ticket not found", status: 404 };
    row.emailStatus = "Sent";
    return { ok: true };
  }
  return call<ResendResponse>("/api/resend", "POST", { ticketId });
}

export async function checkIn(ticketId: string): Promise<CheckinResponse> {
  const id = ticketId.trim().toUpperCase();
  if (USE_MOCK) {
    await wait();
    const row = mockState.accepted.find((a) => a.ticketId === id);
    if (!row) return { ok: false, error: "Invalid ticket", status: 404 };
    if (row.checkInStatus === "Checked In") {
      return {
        ok: false,
        error: "Already checked in",
        status: 409,
        name: row.name,
        checkedInAt: row.checkInTime,
      };
    }
    row.checkInStatus = "Checked In";
    row.checkInTime = new Date().toISOString();
    return { ok: true, name: row.name, organization: row.organization, ticketId: id };
  }
  return call<CheckinResponse>("/api/checkin", "POST", { ticketId: id });
}

// ------------------------------------------------------------------ helpers

export function formatTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
