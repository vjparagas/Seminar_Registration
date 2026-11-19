import { FormCheckResult, Registrant, SkippedRow } from '../types';

// The four standard titles - single source of truth
export const FULL_NAME = 'Full Name';
export const EMAIL_ADDRESS = 'Email Address';
export const ORGANIZATION = 'Organization';
export const CONTACT_NUMBER = 'Contact Number';

export const STANDARD_TITLES = [
  FULL_NAME,
  EMAIL_ADDRESS,
  ORGANIZATION,
  CONTACT_NUMBER,
] as const;

// ASSUMED: checkFormHeaders evaluates row 1 against the 4 standard titles
export function checkFormHeaders(headers: string[]): FormCheckResult {
  const normalized = headers.map((h) => h.trim().toLowerCase().replace(/\s+/g, ' '));
  const counts = new Map<string, { count: number; original: string; colIndex: number }>();

  headers.forEach((h, idx) => {
    const key = h.trim().toLowerCase().replace(/\s+/g, ' ');
    const existing = counts.get(key) || { count: 0, original: h, colIndex: idx };
    existing.count += 1;
    counts.set(key, existing);
  });

  const getColLetter = (index: number) => String.fromCharCode(65 + index);

  const missing: string[] = [];
  const duplicates: string[] = [];
  const fields: FormCheckResult['fields'] = {};

  const mapping: Record<string, keyof NonNullable<FormCheckResult['fields']>> = {
    [FULL_NAME.toLowerCase()]: 'name',
    [EMAIL_ADDRESS.toLowerCase()]: 'email',
    [ORGANIZATION.toLowerCase()]: 'organization',
    [CONTACT_NUMBER.toLowerCase()]: 'contact',
  };

  for (const title of STANDARD_TITLES) {
    const norm = title.toLowerCase();
    const item = counts.get(norm);
    const fieldKey = mapping[norm];

    if (!item || item.count === 0) {
      missing.push(title);
      fields[fieldKey] = { status: 'missing' };
    } else if (item.count > 1) {
      duplicates.push(title);
      fields[fieldKey] = { status: 'duplicate' };
    } else {
      fields[fieldKey] = { status: 'ok', column: getColLetter(item.colIndex) };
    }
  }

  const extras: string[] = [];
  const standardNormSet = new Set(STANDARD_TITLES.map((t) => t.toLowerCase()));
  standardNormSet.add('timestamp');

  for (const h of headers) {
    const norm = h.trim().toLowerCase().replace(/\s+/g, ' ');
    if (norm && !standardNormSet.has(norm)) {
      extras.push(h.trim());
    }
  }

  const ok = missing.length === 0 && duplicates.length === 0;

  return {
    ok,
    fields,
    missing: missing.length ? missing : undefined,
    duplicates: duplicates.length ? duplicates : undefined,
    extras: extras.length ? extras : undefined,
  };
}

// ASSUMED: cleanFormRows cleans raw rows, tracks skipped rows, removes duplicates, excludes already accepted
export function cleanFormRows(
  rows: string[][],
  acceptedEmails: Set<string> = new Set()
): { registrants: Registrant[]; skipped: SkippedRow[] } {
  if (rows.length === 0) {
    return { registrants: [], skipped: [] };
  }

  const headers = rows[0].map((h) => h.trim());
  const normHeaders = headers.map((h) => h.toLowerCase().replace(/\s+/g, ' '));

  const nameCol = normHeaders.indexOf(FULL_NAME.toLowerCase());
  const emailCol = normHeaders.indexOf(EMAIL_ADDRESS.toLowerCase());
  const orgCol = normHeaders.indexOf(ORGANIZATION.toLowerCase());
  const contactCol = normHeaders.indexOf(CONTACT_NUMBER.toLowerCase());
  const timeCol = normHeaders.indexOf('timestamp');

  const registrants: Registrant[] = [];
  const skipped: SkippedRow[] = [];
  const seenEmails = new Set<string>();

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  for (let i = 1; i < rows.length; i++) {
    const rowNum = i + 1;
    const row = rows[i];

    const rawName = nameCol >= 0 ? (row[nameCol] ?? '') : '';
    const rawEmail = emailCol >= 0 ? (row[emailCol] ?? '') : '';
    const rawOrg = orgCol >= 0 ? (row[orgCol] ?? '') : '';
    const rawContact = contactCol >= 0 ? (row[contactCol] ?? '') : '';
    const timestamp = timeCol >= 0 ? (row[timeCol] ?? '') : '';

    const name = rawName.trim().replace(/\s+/g, ' ');
    const email = rawEmail.trim().toLowerCase();
    const organization = rawOrg.trim();
    const contact = rawContact.trim();

    if (!name) {
      skipped.push({ row: rowNum, email: email || undefined, reason: 'Name is missing' });
      continue;
    }

    if (!email) {
      skipped.push({ row: rowNum, reason: 'Email is empty' });
      continue;
    }

    if (!emailRegex.test(email)) {
      skipped.push({ row: rowNum, email, reason: 'Invalid email address' });
      continue;
    }

    if (seenEmails.has(email)) {
      skipped.push({ row: rowNum, email, reason: 'Duplicate email (earliest kept)' });
      continue;
    }

    seenEmails.add(email);

    if (acceptedEmails.has(email)) {
      // Already accepted, skip from registered list
      continue;
    }

    const extra: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      if (
        c !== nameCol &&
        c !== emailCol &&
        c !== orgCol &&
        c !== contactCol &&
        c !== timeCol &&
        headers[c]
      ) {
        extra[headers[c]] = (row[c] ?? '').trim();
      }
    }

    registrants.push({
      email,
      name,
      organization,
      contact,
      timestamp,
      extra,
    });
  }

  return { registrants, skipped };
}
