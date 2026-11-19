"use client";

import { useState } from "react";
import { AcceptResult, UiRegistrant, UiSkipped, formatTime } from "@/lib/client";

const MAX_PER_REQUEST = 20; // API limit for POST /api/accept

type Props = {
  rows: UiRegistrant[];
  skipped: UiSkipped[];
  onAdd: (emails: string[]) => Promise<AcceptResult[] | null>;
};

export default function RegisteredTab({ rows, skipped, onAdd }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<AcceptResult[] | null>(null);

  const filtered = rows.filter((r) =>
    `${r.name} ${r.email} ${r.organization}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const visibleEmails = filtered.map((r) => r.email);
  const allSelected =
    visibleEmails.length > 0 && visibleEmails.every((e) => selected.includes(e));
  const atLimit = selected.length >= MAX_PER_REQUEST;

  function toggleOne(email: string) {
    if (selected.includes(email)) {
      setSelected(selected.filter((e) => e !== email));
    } else if (!atLimit) {
      setSelected([...selected, email]);
    }
  }

  function toggleAll() {
    if (allSelected) {
      setSelected(selected.filter((e) => !visibleEmails.includes(e)));
    } else {
      const toAdd = visibleEmails.filter((e) => !selected.includes(e));
      setSelected(
        [...selected, ...toAdd].slice(0, MAX_PER_REQUEST)
      );
    }
  }

  async function handleAdd() {
    setBusy(true);
    setResults(null);
    const res = await onAdd(selected);
    setBusy(false);
    if (res) {
      setResults(res);
      setSelected([]);
    }
  }

  const accepted = results?.filter((r) => r.status === "accepted").length ?? 0;
  const problems = results?.filter((r) => r.status !== "accepted") ?? [];

  return (
    <div className="bg-white rounded-xl shadow p-4">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between mb-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, or organization"
          className="border rounded-lg px-3 py-2 w-full sm:max-w-xs bg-white text-gray-900"
        />
        <button
          onClick={handleAdd}
          disabled={selected.length === 0 || busy}
          className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-40"
        >
          {busy
            ? "Sending tickets..."
            : `Add ${selected.length} to Accepted`}
        </button>
      </div>

      <p className="text-xs text-gray-500 mb-3">
        You can accept up to {MAX_PER_REQUEST} people at a time.
        {atLimit && " Limit reached."}
      </p>

      {results && (
        <div className="rounded-lg bg-gray-50 border px-4 py-3 mb-3 text-sm">
          <p className="font-medium">
            Accepted {accepted} of {results.length}.
          </p>
          {problems.length > 0 && (
            <ul className="mt-1 text-red-700 list-disc pl-5">
              {problems.map((p) => (
                <li key={p.email}>
                  {p.email}: {p.status}
                  {p.reason ? ` (${p.reason})` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-gray-500 text-sm py-6 text-center">
          No registrants waiting.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="border-b text-gray-500">
              <tr>
                <th className="py-2 pr-2">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Select all"
                  />
                </th>
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Email</th>
                <th className="py-2 pr-4">Organization</th>
                <th className="py-2 pr-4">Contact</th>
                <th className="py-2">Registered</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.email} className="border-b last:border-0">
                  <td className="py-2 pr-2">
                    <input
                      type="checkbox"
                      checked={selected.includes(r.email)}
                      disabled={!selected.includes(r.email) && atLimit}
                      onChange={() => toggleOne(r.email)}
                      aria-label={`Select ${r.name}`}
                    />
                  </td>
                  <td className="py-2 pr-4">{r.name}</td>
                  <td className="py-2 pr-4">{r.email}</td>
                  <td className="py-2 pr-4">{r.organization}</td>
                  <td className="py-2 pr-4">{r.contact}</td>
                  <td className="py-2 text-gray-500">
                    {formatTime(r.timestamp)}
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

      {skipped.length > 0 && (
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer text-amber-700">
            {skipped.length} sheet row(s) skipped (invalid data)
          </summary>
          <ul className="mt-2 list-disc pl-5 text-gray-600">
            {skipped.map((s) => (
              <li key={`${s.row}-${s.email ?? ""}`}>
                Row {s.row}
                {s.email ? ` (${s.email})` : ""}: {s.reason}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
