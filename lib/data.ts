import {
  readTab as rawReadTab,
  getTabs,
  ensureTabs,
  appendRows,
  updateCell,
  SheetsError,
  ACCEPTED_TAB,
  ACCEPTED_HEADERS,
  loadResponses,
} from './sheets';
import { checkHeaders, cleanRows } from './formStandard';

export {
  checkHeaders,
  cleanRows,
  loadResponses,
  getTabs,
  ensureTabs,
  appendRows,
  updateCell,
  SheetsError,
  ACCEPTED_TAB,
  ACCEPTED_HEADERS,
};

/**
 * Wraps readTab so every row is padded with "" up to the length of that tab's header row
 * (Sheets API drops trailing empty cells).
 */
export async function readTab(tab: string, range = 'A:ZZ'): Promise<string[][]> {
  const rows = await rawReadTab(tab, range);
  if (rows.length === 0) return rows;

  const headerLength = rows[0].length;
  return rows.map((row, i) => {
    if (i === 0 || row.length >= headerLength) return row;
    const padded = [...row];
    while (padded.length < headerLength) {
      padded.push('');
    }
    return padded;
  });
}
