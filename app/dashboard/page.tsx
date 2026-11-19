"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AcceptResult,
  UiAccepted,
  UiRegistrant,
  UiSkipped,
  acceptEmails,
  checkIn,
  getAccepted,
  getRegistrants,
  logout,
} from "@/lib/client";
import RegisteredTab from "@/components/RegisteredTab";
import AcceptedTab from "@/components/AcceptedTab";
import ScannerTab from "@/components/ScannerTab";

const tabs = ["Registered", "Accepted", "Scanner"] as const;
type Tab = (typeof tabs)[number];

export default function DashboardPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("Registered");
  const [registered, setRegistered] = useState<UiRegistrant[]>([]);
  const [skipped, setSkipped] = useState<UiSkipped[]>([]);
  const [accepted, setAccepted] = useState<UiAccepted[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    const [reg, acc] = await Promise.all([getRegistrants(), getAccepted()]);

    if (reg.ok) {
      setRegistered(reg.registrants);
      setSkipped(reg.skipped);
    } else {
      // 422 means the Google Form check failed (missing / duplicate columns).
      const parts = [reg.error];
      if (reg.missing?.length) parts.push(`Missing: ${reg.missing.join(", ")}`);
      if (reg.duplicates?.length)
        parts.push(`Duplicates: ${reg.duplicates.join(", ")}`);
      setError(parts.join(" | "));
    }

    if (acc.ok) {
      setAccepted(acc.accepted);
    } else if (reg.ok) {
      setError(acc.error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function handleAdd(emails: string[]): Promise<AcceptResult[] | null> {
    const res = await acceptEmails(emails);
    if (!res.ok) {
      setError(res.error);
      return null;
    }
    await load();
    return res.results;
  }

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  return (
    <main className="min-h-screen bg-gray-100 text-gray-900">
      <header className="bg-white shadow px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold">Event Check-in Dashboard</h1>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="text-sm border rounded-lg px-3 py-1 hover:bg-gray-100"
          >
            Refresh
          </button>
          <button
            onClick={handleLogout}
            className="text-sm border rounded-lg px-3 py-1 hover:bg-gray-100"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto p-4">
        <div className="flex gap-2 mb-4">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                tab === t
                  ? "bg-blue-600 text-white"
                  : "bg-white border hover:bg-gray-50"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {error && (
          <div className="bg-red-100 text-red-700 rounded-lg px-4 py-3 mb-4 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-gray-500 text-sm py-6 text-center">Loading...</p>
        ) : (
          <>
            {tab === "Registered" && (
              <RegisteredTab
                rows={registered}
                skipped={skipped}
                onAdd={handleAdd}
              />
            )}
            {tab === "Accepted" && (
              <AcceptedTab rows={accepted} onChanged={load} />
            )}
            {tab === "Scanner" && (
              <ScannerTab
                onCheckIn={async (id) => {
                  const res = await checkIn(id);
                  if (res.ok) await load();
                  return res;
                }}
              />
            )}
          </>
        )}
      </div>
    </main>
  );
}
