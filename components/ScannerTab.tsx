"use client";

import { useEffect, useRef, useState } from "react";
import type { Html5Qrcode } from "html5-qrcode";
import { CheckinResponse, formatTime } from "@/lib/client";

type Props = {
  onCheckIn: (ticketId: string) => Promise<CheckinResponse>;
};

type Entry = { ok: boolean; message: string; time: string };

const SCAN_LOCK_MS = 2000; // ignore new scans for 2 seconds after one

export default function ScannerTab({ onCheckIn }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lockRef = useRef(false);
  const onCheckInRef = useRef(onCheckIn);

  const [ticketId, setTicketId] = useState("");
  const [busy, setBusy] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [result, setResult] = useState<Entry | null>(null);
  const [recent, setRecent] = useState<Entry[]>([]);

  // Keep the latest onCheckIn available to the camera callback.
  useEffect(() => {
    onCheckInRef.current = onCheckIn;
  }, [onCheckIn]);

  // Turn the camera off when leaving this tab.
  useEffect(() => {
    return () => {
      const scanner = scannerRef.current;
      if (scanner) {
        scanner
          .stop()
          .then(() => scanner.clear())
          .catch(() => {});
      }
    };
  }, []);

  async function submit(rawId: string) {
    const id = rawId.trim();
    if (id === "") return;
    setBusy(true);
    const res = await onCheckInRef.current(id);
    setBusy(false);

    const time = new Date().toISOString();
    let entry: Entry;
    let headline: string;
    if (res.ok) {
      entry = {
        ok: true,
        message: `${res.name}${res.organization ? ` (${res.organization})` : ""}`,
        time,
      };
      headline = `Checked in: ${entry.message}`;
    } else if (res.status === 409) {
      entry = {
        ok: false,
        message: `Already checked in: ${res.name ?? ""}${
          res.checkedInAt ? ` at ${formatTime(res.checkedInAt)}` : ""
        }`,
        time,
      };
      headline = entry.message;
    } else {
      entry = { ok: false, message: res.error, time };
      headline = entry.message;
    }

    setResult({ ...entry, message: headline });
    setRecent((prev) => [entry, ...prev].slice(0, 5));
  }

  async function handleManualSubmit() {
    if (ticketId.trim() === "" || busy) return;
    const id = ticketId;
    setTicketId("");
    await submit(id);
    // Ready for the next entry right away.
    inputRef.current?.focus();
  }

  async function startCamera() {
    setCameraError("");
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
          // 2-second scan lock so one QR is not submitted many times.
          if (lockRef.current) return;
          lockRef.current = true;
          setTimeout(() => {
            lockRef.current = false;
          }, SCAN_LOCK_MS);
          void submit(decodedText);
        },
        () => {
          // No QR in this frame. Ignore.
        }
      );
      setCameraOn(true);
    } catch (err) {
      scannerRef.current = null;
      const msg = err instanceof Error ? err.message : String(err);
      setCameraError(
        `Could not open the camera. Allow camera access in your browser (needs https or localhost). ${msg}`
      );
    }
  }

  async function stopCamera() {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (scanner) {
      try {
        await scanner.stop();
        scanner.clear();
      } catch {
        // already stopped
      }
    }
    setCameraOn(false);
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <h2 className="font-bold mb-1">Check in an attendee</h2>
        <p className="text-sm text-gray-500 mb-4">
          Scan the QR code with the camera, or type the Ticket ID and press
          Enter.
        </p>

        {/* Camera. The library draws the video inside this box. */}
        <div
          id="qr-reader"
          className={
            cameraOn
              ? "w-full overflow-hidden rounded-lg mb-3"
              : "hidden"
          }
        />
        {!cameraOn && (
          <div className="bg-gray-100 border border-dashed border-gray-300 rounded-lg h-40 flex items-center justify-center text-gray-400 text-sm mb-3">
            Camera is off
          </div>
        )}

        {cameraError && (
          <p className="text-sm text-red-600 mb-3">{cameraError}</p>
        )}

        <button
          onClick={cameraOn ? stopCamera : startCamera}
          className={`w-full rounded-lg px-4 py-2 text-sm font-medium mb-4 border ${
            cameraOn
              ? "border-gray-300 text-gray-700 hover:bg-gray-100"
              : "bg-blue-600 text-white border-blue-600 hover:bg-blue-700"
          }`}
        >
          {cameraOn ? "Stop camera" : "Start camera"}
        </button>

        <label className="block text-sm font-medium mb-1" htmlFor="ticket">
          Or type the Ticket ID
        </label>
        <div className="flex gap-2">
          <input
            id="ticket"
            ref={inputRef}
            autoComplete="off"
            autoCapitalize="characters"
            value={ticketId}
            onChange={(e) => setTicketId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleManualSubmit()}
            placeholder="e.g. A1B2C3D4E5"
            className="border border-gray-300 rounded-lg px-3 py-2 flex-1 font-mono bg-white text-gray-900"
          />
          <button
            onClick={handleManualSubmit}
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