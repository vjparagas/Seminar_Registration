// Data layer abstraction
// In development, this delegates to lib/mocks until Member 3 provides lib/sheets.ts and lib/formStandard.ts

export {
  getTabs,
  ensureTabs,
  readTab,
  appendRows,
  updateCell,
} from './mocks/mockSheets';

export {
  FULL_NAME,
  EMAIL_ADDRESS,
  ORGANIZATION,
  CONTACT_NUMBER,
  STANDARD_TITLES,
  // ASSUMED: checkFormHeaders from Member 3's lib/formStandard.ts
  checkFormHeaders,
  // ASSUMED: cleanFormRows from Member 3's lib/formStandard.ts
  cleanFormRows,
} from './mocks/mockFormStandard';
