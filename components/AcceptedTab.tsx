"use client";

import { useState } from "react";
import { UiAccepted, formatTime, resendEmail } from "@/lib/client";

type Props = {
  rows: UiAccepted[];
  onChanged: () => void;
};

function emailBadge(status: string) {
  if (status === "Sent") return "bg-green-100 text-green-700";
  if (status === "Pending") return "bg-yellow-100 text-yellow-700";
  return "bg-red-100 text-red-700"; // "Failed: reason"
}

export default function AcceptedTab({ rows, onChanged }: Props) {
  const [search, setSearch] = useState("");
  const [sending, setSending] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const filtered = rows.filter((r) =>
    `${r.name} ${r.email} ${r.ticketId}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const checkedInCount = rows.filter(
    (r) => r.checkInStatus === "Checked In"
  ).length;

  async function handleResend(ticketId: string) {
    setSending(ticketId);
    setMessage("");
    const res = await resendEmail(ticketId);
    setSending(null);
    setMessage(res.ok ? "Email sent." : res.error);
    onChanged();
  }

  return (
    <div className="bg-white rounded-xl shadow p-4">
      <div className="flex gap-3 mb-3">
        <div className="bg-gray-100 rounded-lg px-4 py-2 text-sm">
          Accepted: <b>{rows.length}</b>
        </div>
        <div className="bg-green-100 rounded-lg px-4 py-2 text-sm">
          Checked in: <b>{checkedInCount}</b>
        </div>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search name, email, or ticket ID"
        className="border rounded-lg px-3 py-2 w-full sm:max-w-xs mb-3 bg-white text-gray-900"
      />

      {message && <p className="text-sm text-gray-700 mb-3">{message}</p>}

      {rows.length === 0 ? (
        <p className="text-gray-500 text-sm py-6 text-center">
          No accepted attendees yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="border-b text-gray-500">
              <tr>
                <th className="py-2 pr-4">Ticket ID</th>
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Email</th>
                <th className="py-2 pr-4">Email status</th>
                <th className="py-2 pr-4">Check-in</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.ticketId} className="border-b last:border-0">
                  <td className="py-2 pr-4 font-mono">{r.ticketId}</td>
                  <td className="py-2 pr-4">{r.name}</td>
                  <td className="py-2 pr-4">{r.email}</td>
                  <td className="py-2 pr-4">
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
                  <td className="py-2 pr-4">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        r.checkInStatus === "Checked In"
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {r.checkInStatus}
                    </span>
                    {r.checkInTime && (
                      <span className="text-xs text-gray-500 ml-2">
                        {formatTime(r.checkInTime)}
                      </span>
                    )}
                  </td>
                  <td className="py-2">
                    <button
                      onClick={() => handleResend(r.ticketId)}
                      disabled={sending === r.ticketId}
                      className="text-blue-600 text-xs hover:underline disabled:opacity-50"
                    >
                      {sending === r.ticketId ? "Sending..." : "Resend email"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="text-gray-500 text-sm py-6 text-center">
              No results for that search.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
