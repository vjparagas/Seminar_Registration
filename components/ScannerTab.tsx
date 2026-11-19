"use client";

import { useRef, useState } from "react";
import { CheckinResponse, formatTime } from "@/lib/client";

type Props = {
  onCheckIn: (ticketId: string) => Promise<CheckinResponse>;
};

type Entry = { ok: boolean; message: string; time: string };

export default function ScannerTab({ onCheckIn }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [ticketId, setTicketId] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Entry | null>(null);
  const [recent, setRecent] = useState<Entry[]>([]);

  async function handleSubmit() {
    if (ticketId.trim() === "" || busy) return;
    setBusy(true);
    const res = await onCheckIn(ticketId);
    setBusy(false);

    let entry: Entry;
    if (res.ok) {
      entry = {
        ok: true,
        message: `${res.name}${res.organization ? ` (${res.organization})` : ""}`,
        time: new Date().toISOString(),
      };
    } else if (res.status === 409) {
      entry = {
        ok: false,
        message: `Already checked in: ${res.name ?? ""}${
          res.checkedInAt ? ` at ${formatTime(res.checkedInAt)}` : ""
        }`,
        time: new Date().toISOString(),
      };
    } else {
      entry = { ok: false, message: res.error, time: new Date().toISOString() };
    }

    setResult({ ...entry, message: res.ok ? `Checked in: ${entry.message}` : entry.message });
    setRecent((prev) => [entry, ...prev].slice(0, 5));
    setTicketId("");
    // Ready for the next scan right away.
    inputRef.current?.focus();
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <h2 className="font-bold mb-1">Check in an attendee</h2>
        <p className="text-sm text-gray-500 mb-4">
          Scan the QR code with a scanner, or type the Ticket ID and press
          Enter.
        </p>

        {/* Camera goes here. The scanner person replaces this box.
            The QR contains ONLY the Ticket ID, so pass the scanned text
            to handleSubmit / onCheckIn. */}
        <div className="bg-gray-100 border border-dashed border-gray-300 rounded-lg h-40 flex items-center justify-center text-gray-400 text-sm mb-4">
          Camera view (coming soon)
        </div>

        <label className="block text-sm font-medium mb-1" htmlFor="ticket">
          Ticket ID
        </label>
        <div className="flex gap-2">
          <input
            id="ticket"
            ref={inputRef}
            autoFocus
            autoComplete="off"
            autoCapitalize="characters"
            value={ticketId}
            onChange={(e) => setTicketId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="e.g. A1B2C3D4E5"
            className="border border-gray-300 rounded-lg px-3 py-2 flex-1 font-mono bg-white text-gray-900"
          />
          <button
            onClick={handleSubmit}
            disabled={busy || ticketId.trim() === ""}
            className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-40"
          >
            {busy ? "Checking..." : "Check in"}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {result ? (
          <div
            className={`rounded-xl p-6 text-white ${
              result.ok ? "bg-green-600" : "bg-red-600"
            }`}
          >
            <p className="text-3xl mb-1">{result.ok ? "✓" : "✕"}</p>
            <p className="text-lg font-semibold">{result.message}</p>
          </div>
        ) : (
          <div className="rounded-xl p-6 bg-white border border-dashed border-gray-300 text-gray-400 text-sm text-center">
            The result of the next check-in will show here.
          </div>
        )}

        {recent.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <h3 className="text-sm font-semibold mb-2">Recent scans</h3>
            <ul className="divide-y divide-gray-100 text-sm">
              {recent.map((e, i) => (
                <li key={`${e.time}-${i}`} className="py-2 flex gap-2">
                  <span className={e.ok ? "text-green-600" : "text-red-600"}>
                    {e.ok ? "✓" : "✕"}
                  </span>
                  <span className="flex-1">{e.message}</span>
                  <span className="text-xs text-gray-400">
                    {formatTime(e.time)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}