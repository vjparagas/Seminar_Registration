"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/client";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (password.trim() === "") {
      setError("Please enter the password.");
      return;
    }
    setError("");
    setLoading(true);
    const res = await login(password);
    setLoading(false);
    if (!res.ok) {
      setError(res.status === 401 ? "Wrong password." : res.error);
      return;
    }
    router.push("/dashboard");
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-100 p-4 text-gray-900">
      <div className="w-full max-w-sm bg-white rounded-xl shadow p-6">
        <h1 className="text-2xl font-bold mb-1">Organizer Login</h1>
        <p className="text-sm text-gray-500 mb-4">
          Enter the password to open the check-in dashboard.
        </p>

        <label className="block text-sm font-medium mb-1" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          className="w-full border rounded-lg px-3 py-2 mb-3 bg-white text-gray-900"
          placeholder="Enter password"
          autoFocus
        />

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-blue-600 text-white rounded-lg py-2 font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Logging in..." : "Login"}
        </button>
      </div>
    </main>
  );
}
