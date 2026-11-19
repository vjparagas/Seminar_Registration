"use client";

import { useState } from "react";
import { UiAccepted, formatTime, resendEmail } from "@/lib/client";

type Props = {
  rows: UiAccepted[];
  onChanged: () => void;
};

type Filter = "All" | "Not checked in" | "Checked in" | "Email failed";
const filters: Filter[] = ["All", "Not checked in", "Checked in", "Email failed"];

function emailBadge(status: string) {
  if (status === "Sent") return "bg-green-100 text-green-700";
  if (status === "Pending") return "bg-yellow-100 text-yellow-700";
  return "bg-red-100 text-red-700"; // "Failed: reason"
}

function matches(r: UiAccepted, f: Filter) {
  if (f === "Not checked in") return r.checkinStatus !== "Checked In";
  if (f === "Checked in") return r.checkinStatus === "Checked In";
  if (f === "Email failed") return r.emailStatus.startsWith("Failed");
  return true;
}

export default function AcceptedTab({ rows, onChanged }: Props) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("All");
  const [sending, setSending] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null
  );

  const filtered = rows.filter(
    (r) =>
      matches(r, filter) &&
      `${r.name} ${r.email} ${r.ticketId}`
        .toLowerCase()
        .includes(search.toLowerCase())
  );

  async function handleResend(ticketId: string, email: string) {
    setSending(ticketId);
    setMessage(null);
    const res = await resendEmail(ticketId);
    setSending(null);
    setMessage(
      res.ok
        ? { ok: true, text: `Ticket email sent to ${email}.` }
        : { ok: false, text: `Could not send to ${email}: ${res.error}` }
    );
    onChanged();
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between mb-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, or ticket ID"
          className="border border-gray-300 rounded-lg px-3 py-2 w-full sm:max-w-xs bg-white text-gray-900"
        />
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
                filter === f
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
              }`}
            >
              {f} ({rows.filter((r) => matches(r, f)).length})
            </button>
          ))}
        </div>
      </div>

      {message && (
        <div
          className={`rounded-lg px-4 py-2 mb-3 text-sm ${
            message.ok
              ? "bg-green-50 text-green-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-gray-500 text-sm py-10 text-center">
          Nobody is accepted yet. Go to the Registered tab and accept some
          people.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="border-b border-gray-200 text-gray-500 text-xs uppercase">
              <tr>
                <th className="py-2 pr-4">Ticket ID</th>
                <th className="py-2 pr-4">Attendee</th>
                <th className="py-2 pr-4">Email status</th>
                <th className="py-2 pr-4">Check-in</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.ticketId}
                  className="border-b border-gray-100 last:border-0 hover:bg-gray-50"
                >
                  <td className="py-3 pr-4 font-mono text-xs">{r.ticketId}</td>
                  <td className="py-3 pr-4">
                    <p className="font-medium">{r.name}</p>
                    <p className="text-xs text-gray-500">
                      {r.email}
                      {r.organization ? ` · ${r.organization}` : ""}
                    </p>
                  </td>
                  <td className="py-3 pr-4">
                    <span
                      title={r.emailStatus}
                      className={`px-2 py-1 rounded text-xs ${emailBadge(
                        r.emailStatus
                      )}`}
                    >
                      {r.emailStatus.startsWith("Failed")
                        ? "Failed"
                        : r.emailStatus}
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        r.checkinStatus === "Checked In"
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {r.checkinStatus}
                    </span>
                    {r.checkinTime && (
                      <p className="text-xs text-gray-500 mt-1">
                        {formatTime(r.checkinTime)}
                      </p>
                    )}
                  </td>
                  <td className="py-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => handleResend(r.ticketId, r.email)}
                      disabled={sending === r.ticketId}
                      className={`text-xs rounded-lg px-3 py-1.5 border disabled:opacity-50 ${
                        r.emailStatus === "Sent"
                          ? "border-gray-300 text-gray-600 hover:bg-gray-100"
                          : "border-blue-600 text-blue-600 hover:bg-blue-50"
                      }`}
                    >
                      {sending === r.ticketId ? "Sending..." : "Resend email"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="text-gray-500 text-sm py-10 text-center">
              No one matches that search or filter.
            </p>
          )}
        </div>
      )}
    </div>
  );
}