/**
 * Form standard: the single source of truth for the Google Form column titles.
 *
 * Every other module imports the titles from here. Nothing in this file guesses
 * or detects columns: each standard title is looked up by its exact text
 * (ignoring only upper/lower case and extra spaces). Near-miss titles are
 * reported as a HINT for the host and are never mapped automatically.
 *
 * Pure functions only (no network, no env), so everything is unit-testable.
 */

export type FieldKey = "name" | "email" | "organization" | "contact";

export const FIELD_KEYS: readonly FieldKey[] = ["name", "email", "organization", "contact"];

export interface StandardField {
  key: FieldKey;
  /** Exact question title the host must use in the Google Form. */
  title: string;
  /** Instruction shown to the host when the column is missing. */
  fix: string;
  /** Only used to word a "did you mean" hint. Never used to map a column. */
  hintWords: string[];
}

export const STANDARD: Record<FieldKey, StandardField> = {
  name: {
    key: "name",
    title: "Full Name",
    fix: 'Add a Short answer question titled exactly "Full Name" and mark it Required.',
    hintWords: ["name"],
  },
  email: {
    key: "email",
    title: "Email Address",
    fix:
      'Add a Short answer question titled exactly "Email Address", mark it Required, ' +
      "and set Response validation > Text > Email.",
    hintWords: ["email", "gmail"],
  },
  organization: {
    key: "organization",
    title: "Organization",
    fix: 'Add a Short answer question titled exactly "Organization" and mark it Required.',
    hintWords: ["organization", "organisation", "company", "school", "affiliation", "institution"],
  },
  contact: {
    key: "contact",
    title: "Contact Number",
    fix:
      'Add a Short answer question titled exactly "Contact Number", mark it Required, ' +
      "and set Response validation > Regular expression > Matches: ^[0-9+ ()-]{7,15}$",
    hintWords: ["contact", "phone", "mobile", "cellphone"],
  },
};

export const STANDARD_TITLES: string[] = FIELD_KEYS.map((k) => STANDARD[k].title);

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Skipped-row reasons, kept in one place so the dashboard and tests agree. */
export const REASON = {
  NAME_MISSING: "name missing",
  EMAIL_MISSING: "email missing",
  EMAIL_INVALID: "email invalid",
} as const;
export const duplicateEmailReason = (firstRow: number) =>
  `duplicate email (first submitted in row ${firstRow})`;

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/** Trim, lowercase, collapse repeated whitespace. This is the ONLY fuzziness allowed. */
export function normalizeHeader(s: unknown): string {
  return String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/** 0 -> A, 25 -> Z, 26 -> AA */
export function colLetter(index: number): string {
  let s = "";
  let n = index + 1;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

const strip = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return dp[a.length][b.length];
}

/** Used only to word a hint. A true result never maps a column. */
function looksLikeAttempt(header: string, std: StandardField): boolean {
  const a = strip(header);
  const b = strip(std.title);
  if (!a) return false;
  if (a === b) return true; // e.g. "Full-Name", "full_name"
  if (levenshtein(a, b) <= 2) return true; // small typo
  if (a.length >= 4 && (b.includes(a) || a.includes(b))) return true; // "Email" vs "Email Address"
  return std.hintWords.some((w) => a.includes(w));
}

// ---------------------------------------------------------------------------
// Form Check (header check, no detection)
// ---------------------------------------------------------------------------

export type FieldStatus = "ok" | "missing" | "duplicate";

export interface FieldCheck {
  field: FieldKey;
  title: string;
  status: FieldStatus;
  /** 0-based column indexes where the exact title was found. */
  columns: number[];
  /** Same columns as letters (A, B, ...). */
  letters: string[];
  /** One line for the host. */
  message: string;
  /** What to do. Empty when status is ok. */
  fix: string;
  /** Optional "did you mean" help for near-miss titles. */
  hint?: string;
}

export interface ExtraColumn {
  index: number;
  header: string;
}

export interface FormCheckReport {
  /** True only when all four standard titles are present exactly once. */
  ready: boolean;
  fields: Record<FieldKey, FieldCheck>;
  /** Standard titles that were not found. */
  missing: string[];
  /** Standard titles that appear more than once. */
  duplicates: string[];
  /** Every other question (Timestamp excluded). Shown as "More details". */
  extras: ExtraColumn[];
  warnings: string[];
}

/**
 * Look up the four standard titles in row 1 of the responses tab.
 * @param headers row 1 of the responses tab
 * @param sampleRows a few data rows, only used to warn about answers under a blank title
 */
export function checkHeaders(
  headers: readonly unknown[],
  sampleRows: readonly (readonly unknown[])[] = [],
): FormCheckReport {
  const heads = headers.map((h) => String(h ?? ""));
  const warnings: string[] = [];

  if (heads.every((h) => !h.trim())) {
    warnings.push("Row 1 is empty. Question titles must be in the first row of the responses tab.");
  } else if (normalizeHeader(heads[0]) !== "timestamp") {
    warnings.push(
      'Column A is not "Timestamp". Make sure this is the form responses tab created by Google Forms.',
    );
  }

  // Where does each normalized title appear?
  const positions = new Map<string, number[]>();
  heads.forEach((h, i) => {
    const n = normalizeHeader(h);
    if (!n) return;
    const list = positions.get(n);
    if (list) list.push(i);
    else positions.set(n, [i]);
  });

  // Answers under a blank title
  const width = Math.max(heads.length, ...sampleRows.map((r) => r.length));
  for (let i = 0; i < width; i++) {
    if (normalizeHeader(heads[i])) continue;
    if (sampleRows.some((r) => String(r[i] ?? "").trim())) {
      warnings.push(
        `Column ${colLetter(i)} has answers but no question title. Give that question a title in the form.`,
      );
    }
  }

  // Exact lookup of the four standard titles
  const found = {} as Record<FieldKey, number[]>;
  const standardCols = new Set<number>();
  for (const key of FIELD_KEYS) {
    const cols = positions.get(normalizeHeader(STANDARD[key].title)) ?? [];
    found[key] = cols;
    cols.forEach((c) => standardCols.add(c));
  }

  const isTimestamp = (i: number) => i === 0 && normalizeHeader(heads[0]) === "timestamp";

  const fields = {} as Record<FieldKey, FieldCheck>;
  for (const key of FIELD_KEYS) {
    const std = STANDARD[key];
    const cols = found[key];
    const letters = cols.map(colLetter);
    const base = { field: key, title: std.title, columns: cols, letters };

    if (cols.length === 1) {
      fields[key] = {
        ...base,
        status: "ok",
        message: `${std.title} (column ${letters[0]}): OK`,
        fix: "",
      };
      continue;
    }

    if (cols.length === 0) {
      const similar = heads
        .map((h, i) => ({ h, i }))
        .filter(({ h, i }) => normalizeHeader(h) && !standardCols.has(i) && !isTimestamp(i) && looksLikeAttempt(h, std))
        .slice(0, 3);

      let hint: string | undefined;
      if (similar.length === 1) {
        hint = `Did you mean "${similar[0].h.trim()}" (column ${colLetter(similar[0].i)})? Rename that question to exactly "${std.title}".`;
      } else if (similar.length > 1) {
        const list = similar.map((c) => `"${c.h.trim()}" (${colLetter(c.i)})`).join(", ");
        hint = `Similar columns found: ${list}. If one of them is the right one, rename that question to exactly "${std.title}".`;
      }

      fields[key] = {
        ...base,
        status: "missing",
        message: `${std.title}: not found.`,
        fix: std.fix,
        ...(hint ? { hint } : {}),
      };
      continue;
    }

    // duplicate
    const where = letters.length === 2 ? `${letters[0]} and ${letters[1]}` : letters.join(", ");
    fields[key] = {
      ...base,
      status: "duplicate",
      message: `${std.title}: found ${cols.length} times (columns ${where}).`,
      fix: `Keep one question titled "${std.title}" and rename or delete the others.`,
      ...(key === "email"
        ? {
            hint:
              'If "Collect email addresses" is turned on in Form settings > Responses, turn it off. ' +
              "It adds its own Email Address column.",
          }
        : {}),
    };
  }

  // Extra questions
  const extras: ExtraColumn[] = [];
  heads.forEach((h, i) => {
    if (!normalizeHeader(h) || standardCols.has(i) || isTimestamp(i)) return;
    extras.push({ index: i, header: h.trim() });
  });

  // Extra questions that share a title cannot be told apart in "More details"
  const extraPositions = new Map<string, ExtraColumn[]>();
  for (const e of extras) {
    const n = normalizeHeader(e.header);
    const list = extraPositions.get(n);
    if (list) list.push(e);
    else extraPositions.set(n, [e]);
  }
  for (const list of extraPositions.values()) {
    if (list.length > 1) {
      warnings.push(
        `Columns ${list.map((e) => colLetter(e.index)).join(", ")} share the title "${list[0].header}". Rename them so their answers can be told apart.`,
      );
    }
  }

  const missing = FIELD_KEYS.filter((k) => fields[k].status === "missing").map((k) => STANDARD[k].title);
  const duplicates = FIELD_KEYS.filter((k) => fields[k].status === "duplicate").map((k) => STANDARD[k].title);

  return {
    ready: missing.length === 0 && duplicates.length === 0,
    fields,
    missing,
    duplicates,
    extras,
    warnings,
  };
}

/** Plain-text version of the report (for logs, the guide, or a copy button). */
export function formatReport(report: FormCheckReport): string {
  const lines: string[] = [report.ready ? "Form check: ready" : "Form check: action needed"];
  for (const key of FIELD_KEYS) {
    const f = report.fields[key];
    if (f.status === "ok") {
      lines.push(`${f.title} (column ${f.letters[0]})  OK`);
    } else {
      lines.push(`${f.message}`);
      lines.push(`  Fix: ${f.fix}`);
      if (f.hint) lines.push(`  Hint: ${f.hint}`);
    }
  }
  if (report.extras.length) lines.push(`Extra questions: ${report.extras.map((e) => e.header).join(", ")}`);
  for (const w of report.warnings) lines.push(`Warning: ${w}`);
  if (!report.ready) lines.push("Tip: the easiest fix is to make a fresh copy of the template form.");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Row cleaning
// ---------------------------------------------------------------------------

export interface Registrant {
  /** Lowercase, trimmed. The unique key. */
  email: string;
  name: string;
  organization: string;
  contact: string;
  timestamp: string;
  /** 1-based row number in the sheet (header is row 1, first response is row 2). */
  row: number;
  /** Answers to extra questions, keyed by question title. Empty answers are left out. */
  extra: Record<string, string>;
}

export interface SkippedRow {
  row: number;
  reason: string;
  name?: string;
  email?: string;
}

export interface CleanResult {
  registrants: Registrant[];
  skipped: SkippedRow[];
}

const cell = (row: readonly unknown[], index: number | undefined) =>
  index === undefined ? "" : String(row[index] ?? "");

/**
 * Turn raw response rows into clean registrants.
 *
 * @param rows data rows only (the header row removed), in sheet order
 * @param report result of checkHeaders (must be ready)
 * @param opts.acceptedEmails people already in the Accepted tab. They are hidden, not "skipped".
 */
export function cleanRows(
  rows: readonly (readonly unknown[])[],
  report: FormCheckReport,
  opts: { acceptedEmails?: ReadonlySet<string> } = {},
): CleanResult {
  if (!report.ready) {
    throw new Error("cleanRows called while the Form Check is failing. Fix the form first.");
  }
  const accepted = opts.acceptedEmails ?? new Set<string>();
  const col = {
    name: report.fields.name.columns[0],
    email: report.fields.email.columns[0],
    organization: report.fields.organization.columns[0],
    contact: report.fields.contact.columns[0],
  };

  const registrants: Registrant[] = [];
  const skipped: SkippedRow[] = [];
  const firstRowByEmail = new Map<string, number>();

  rows.forEach((raw, i) => {
    const rowNumber = i + 2;

    // completely empty rows are ignored silently
    if (raw.every((v) => !String(v ?? "").trim())) return;

    const name = cell(raw, col.name).trim().replace(/\s+/g, " ");
    const email = cell(raw, col.email).trim().toLowerCase();

    if (!name) {
      skipped.push({ row: rowNumber, reason: REASON.NAME_MISSING, ...(email ? { email } : {}) });
      return;
    }
    if (!email) {
      skipped.push({ row: rowNumber, reason: REASON.EMAIL_MISSING, name });
      return;
    }
    if (!EMAIL_RE.test(email)) {
      skipped.push({ row: rowNumber, reason: REASON.EMAIL_INVALID, name, email });
      return;
    }
    if (accepted.has(email)) return; // already accepted: hidden from the Registered list

    const first = firstRowByEmail.get(email);
    if (first !== undefined) {
      skipped.push({ row: rowNumber, reason: duplicateEmailReason(first), name, email });
      return;
    }
    firstRowByEmail.set(email, rowNumber);

    const extra: Record<string, string> = {};
    for (const e of report.extras) {
      const v = cell(raw, e.index).trim();
      if (v) extra[e.header] = v;
    }

    registrants.push({
      email,
      name,
      organization: cell(raw, col.organization).trim(),
      contact: cell(raw, col.contact).trim(),
      timestamp: String(raw[0] ?? ""),
      row: rowNumber,
      extra,
    });
  });

  return { registrants, skipped };
}
