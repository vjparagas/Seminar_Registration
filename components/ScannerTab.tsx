"use client";

import { useState } from "react";
import { CheckinResponse, formatTime } from "@/lib/client";

type Props = {
  onCheckIn: (ticketId: string) => Promise<CheckinResponse>;
};

export default function ScannerTab({ onCheckIn }: Props) {
  const [ticketId, setTicketId] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(
    null
  );

  async function handleSubmit() {
    if (ticketId.trim() === "" || busy) return;
    setBusy(true);
    const res = await onCheckIn(ticketId);
    setBusy(false);

    if (res.ok) {
      setResult({
        ok: true,
        message: `Checked in: ${res.name} (${res.organization})`,
      });
    } else if (res.status === 409) {
      setResult({
        ok: false,
        message: `Already checked in: ${res.name ?? ""}${
          res.checkedInAt ? ` at ${formatTime(res.checkedInAt)}` : ""
        }`,
      });
    } else {
      setResult({ ok: false, message: res.error });
    }
    setTicketId("");
  }

  return (
    <div className="bg-white rounded-xl shadow p-4 max-w-md">
      <h2 className="font-bold mb-3">Scan QR Code</h2>

      {/* Camera goes here. The scanner person replaces this box.
          The QR contains ONLY the Ticket ID, so pass the scanned text
          to handleSubmit / onCheckIn. */}
      <div className="bg-gray-200 rounded-lg h-64 flex items-center justify-center text-gray-500 text-sm mb-4">
        Camera view (coming soon)
      </div>

      {result && (
        <div
          className={`rounded-lg p-4 mb-4 text-white font-medium ${
            result.ok ? "bg-green-600" : "bg-red-600"
          }`}
        >
          {result.message}
        </div>
      )}

      <label className="block text-sm font-medium mb-1" htmlFor="ticket">
        Or type the Ticket ID
      </label>
      <div className="flex gap-2">
        <input
          id="ticket"
          value={ticketId}
          onChange={(e) => setTicketId(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="e.g. A1B2C3D4E5"
          className="border rounded-lg px-3 py-2 flex-1 font-mono bg-white text-gray-900"
        />
        <button
          onClick={handleSubmit}
          disabled={busy}
          className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {busy ? "..." : "Check in"}
        </button>
      </div>
    </div>
  );
}
