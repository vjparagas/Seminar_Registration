import Link from "next/link";

// Public landing page for attendees.
// The Register button opens the Google Form whose link is set in FORM_URL
// (.env.local). Organizers use the "Organizer login" link.

const steps = [
  {
    title: "Register",
    text: "Fill in your name, email, organization and contact number.",
  },
  {
    title: "Get confirmed",
    text: "The organizer reviews your registration and accepts you.",
  },
  {
    title: "Receive your ticket",
    text: "Your QR code ticket arrives in your email inbox.",
  },
  {
    title: "Check in",
    text: "Show the QR code at the entrance on the day of the event.",
  },
];

export default function Home() {
  const formUrl = process.env.FORM_URL;

  return (
    <main className="min-h-screen flex flex-col bg-gray-50 text-gray-900">
      <header className="flex items-center justify-between px-6 py-4">
        <span className="font-semibold">Seminar Registration</span>
        <Link
          href="/login"
          className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 text-gray-600 hover:bg-white"
        >
          Organizer login
        </Link>
      </header>

      <section className="bg-gradient-to-b from-blue-600 to-blue-700 text-white">
        <div className="max-w-3xl mx-auto px-6 py-16 text-center">
          <h1 className="text-4xl font-bold mb-3">
            Reserve your seat at the seminar
          </h1>
          <p className="text-blue-100 mb-8 max-w-xl mx-auto">
            Register once and get a personal QR code ticket by email for fast
            check-in at the door.
          </p>

          {formUrl ? (
            <a
              href={formUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-white text-blue-700 rounded-lg px-8 py-3 font-semibold hover:bg-blue-50"
            >
              Register now
            </a>
          ) : (
            <p className="inline-block text-sm bg-white/15 rounded-lg px-4 py-3">
              Registration opens soon. The form link has not been added yet.
            </p>
          )}
        </div>
      </section>

      <section className="max-w-3xl w-full mx-auto px-6 py-12">
        <h2 className="text-xl font-bold mb-6 text-center">How it works</h2>
        <ol className="grid gap-4 sm:grid-cols-2">
          {steps.map((s, i) => (
            <li
              key={s.title}
              className="bg-white rounded-xl border border-gray-200 p-4 flex gap-3"
            >
              <span className="flex-none w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center">
                {i + 1}
              </span>
              <div>
                <p className="font-semibold">{s.title}</p>
                <p className="text-sm text-gray-600">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}