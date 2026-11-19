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

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("Registered");
  const [registered, setRegistered] = useState<UiRegistrant[]>([]);
  const [skipped, setSkipped] = useState<UiSkipped[]>([]);
  const [accepted, setAccepted] = useState<UiAccepted[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    setRefreshing(true);
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
    setRefreshing(false);
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

  const checkedInCount = accepted.filter(
    (a) => a.checkinStatus === "Checked In"
  ).length;
  const failedEmails = accepted.filter((a) =>
    a.emailStatus.startsWith("Failed")
  ).length;

  const counts: Record<Tab, number | null> = {
    Registered: registered.length,
    Accepted: accepted.length,
    Scanner: null,
  };

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold leading-tight">
            Seminar Check-in
          </h1>
          <p className="text-xs text-gray-500">Organizer dashboard</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            disabled={refreshing}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-100 disabled:opacity-50"
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
          <button
            onClick={handleLogout}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-100"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto p-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <StatCard
            label="Waiting"
            value={registered.length}
            color="text-amber-600"
          />
          <StatCard
            label="Accepted"
            value={accepted.length}
            color="text-blue-600"
          />
          <StatCard
            label="Checked in"
            value={checkedInCount}
            color="text-green-600"
          />
          <StatCard
            label="Email failed"
            value={failedEmails}
            color={failedEmails > 0 ? "text-red-600" : "text-gray-400"}
          />
        </div>

        <div className="flex gap-1 mb-4 border-b border-gray-200">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 ${
                tab === t
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              {t}
              {counts[t] !== null && (
                <span
                  className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                    tab === t
                      ? "bg-blue-100 text-blue-700"
                      : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {counts[t]}
                </span>
              )}
            </button>
          ))}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-4 text-sm flex items-start justify-between gap-3">
            <span>{error}</span>
            <button
              onClick={() => setError("")}
              className="text-red-500 hover:text-red-800"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        )}

        {loading ? (
          <p className="text-gray-500 text-sm py-10 text-center">
            Loading data...
          </p>
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