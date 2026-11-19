// Mock Google Sheets store for development and testing

let formResponsesData: string[][] = [
  // Row 1: Headers (with extra column "Dietary Needs")
  ['Timestamp', 'Full Name', 'Email Address', 'Organization', 'Contact Number', 'Dietary Needs'],
  // Row 2: Valid row (in Accepted as Not Checked In)
  ['2026-11-19T08:00:00Z', 'Alice Johnson', 'alice@example.com', 'Acme Corp', '09171234567', 'None'],
  // Row 3: Valid row (in Accepted as Checked In)
  ['2026-11-19T08:05:00Z', 'Bob Smith', 'bob@example.com', 'Beta Inc', '09181234567', 'Vegetarian'],
  // Row 4: Valid row (not accepted yet)
  ['2026-11-19T08:10:00Z', 'Charlie Brown', 'charlie@example.com', 'Delta Co', '09191234567', 'Halal'],
  // Row 5: Duplicate email (earliest charlie kept)
  ['2026-11-19T08:15:00Z', 'David Duplicate', 'charlie@example.com', 'Delta Co', '09191234567', 'None'],
  // Row 6: Invalid email
  ['2026-11-19T08:20:00Z', 'Eve Invalid', 'not-an-email', 'Omega LLC', '09201234567', 'None'],
  // Row 7: Blank name
  ['2026-11-19T08:25:00Z', '', 'noname@example.com', 'No Name Inc', '09211234567', 'None'],
];

let acceptedData: string[][] = [
  // Row 1: Headers
  ['Ticket ID', 'Email', 'Full Name', 'Organization', 'Contact Number', 'Accepted At', 'Email Status', 'Check-in Status', 'Check-in Time'],
  // Row 2: Accepted, Not Checked In
  ['TICK000001', 'alice@example.com', 'Alice Johnson', 'Acme Corp', '09171234567', '2026-11-19T08:30:00.000Z', 'Sent', 'Not Checked In', ''],
  // Row 3: Accepted, Checked In
  ['TICK000002', 'bob@example.com', 'Bob Smith', 'Beta Inc', '09181234567', '2026-11-19T08:35:00.000Z', 'Sent', 'Checked In', '2026-11-19T09:00:00.000Z'],
];

export async function getTabs(): Promise<string[]> {
  const formTab = process.env.FORM_TAB || 'Form Responses 1';
  return [formTab, 'Accepted'];
}

export async function ensureTabs(): Promise<void> {
  // Ensure default structures exist
  return;
}

export async function readTab(tabName: string): Promise<string[][]> {
  const formTab = process.env.FORM_TAB || 'Form Responses 1';
  if (tabName === formTab) {
    return formResponsesData.map((row) => [...row]);
  }
  if (tabName === 'Accepted') {
    return acceptedData.map((row) => [...row]);
  }
  return [];
}

export async function appendRows(
  tabName: string,
  rows: (string | number)[][]
): Promise<void> {
  const formTab = process.env.FORM_TAB || 'Form Responses 1';
  const stringRows = rows.map((r) => r.map((c) => String(c ?? '')));
  if (tabName === formTab) {
    formResponsesData.push(...stringRows);
  } else if (tabName === 'Accepted') {
    acceptedData.push(...stringRows);
  }
}

export async function updateCell(
  tabName: string,
  cell: string,
  value: string | number
): Promise<void> {
  // cell is e.g. "G2" or "H3"
  const match = cell.toUpperCase().match(/^([A-Z]+)([0-9]+)$/);
  if (!match) {
    throw new Error(`Invalid cell format: ${cell}`);
  }

  const colLetters = match[1];
  const rowNum = parseInt(match[2], 10);
  const rowIndex = rowNum - 1;

  // Convert column letters (A, B, ..., Z, AA) to 0-based column index
  let colIndex = 0;
  for (let i = 0; i < colLetters.length; i++) {
    colIndex = colIndex * 26 + (colLetters.charCodeAt(i) - 64);
  }
  colIndex -= 1;

  const target = tabName === 'Accepted' ? acceptedData : formResponsesData;

  while (target.length <= rowIndex) {
    target.push([]);
  }
  while (target[rowIndex].length <= colIndex) {
    target[rowIndex].push('');
  }

  target[rowIndex][colIndex] = String(value ?? '');
}

// Helper to reset mocks in tests if needed
export function __resetMockData() {
  formResponsesData = [
    ['Timestamp', 'Full Name', 'Email Address', 'Organization', 'Contact Number', 'Dietary Needs'],
    ['2026-11-19T08:00:00Z', 'Alice Johnson', 'alice@example.com', 'Acme Corp', '09171234567', 'None'],
    ['2026-11-19T08:05:00Z', 'Bob Smith', 'bob@example.com', 'Beta Inc', '09181234567', 'Vegetarian'],
    ['2026-11-19T08:10:00Z', 'Charlie Brown', 'charlie@example.com', 'Delta Co', '09191234567', 'Halal'],
    ['2026-11-19T08:15:00Z', 'David Duplicate', 'charlie@example.com', 'Delta Co', '09191234567', 'None'],
    ['2026-11-19T08:20:00Z', 'Eve Invalid', 'not-an-email', 'Omega LLC', '09201234567', 'None'],
    ['2026-11-19T08:25:00Z', '', 'noname@example.com', 'No Name Inc', '09211234567', 'None'],
  ];
  acceptedData = [
    ['Ticket ID', 'Email', 'Full Name', 'Organization', 'Contact Number', 'Accepted At', 'Email Status', 'Check-in Status', 'Check-in Time'],
    ['TICK000001', 'alice@example.com', 'Alice Johnson', 'Acme Corp', '09171234567', '2026-11-19T08:30:00.000Z', 'Sent', 'Not Checked In', ''],
    ['TICK000002', 'bob@example.com', 'Bob Smith', 'Beta Inc', '09181234567', '2026-11-19T08:35:00.000Z', 'Sent', 'Checked In', '2026-11-19T09:00:00.000Z'],
  ];
}
