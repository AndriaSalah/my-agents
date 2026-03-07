import { google } from 'googleapis';

const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

type SpreadsheetIdInput = {
  spreadsheetId?: string;
  sheetUrl?: string;
};

export function extractSpreadsheetIdFromUrl(sheetUrl: string): string | null {
  const match = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match?.[1] ?? null;
}

export function resolveSpreadsheetId(input: SpreadsheetIdInput): string {
  if (input.spreadsheetId?.trim()) {
    return input.spreadsheetId.trim();
  }

  if (input.sheetUrl?.trim()) {
    const parsed = extractSpreadsheetIdFromUrl(input.sheetUrl.trim());
    if (parsed) {
      return parsed;
    }
  }

  throw new Error('Provide either spreadsheetId or a valid Google Sheet URL in sheetUrl');
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value?.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function readEnvWithFallback(primary: string, fallback: string): string {
  const primaryValue = process.env[primary];
  if (primaryValue?.trim()) {
    return primaryValue;
  }

  return requiredEnv(fallback);
}

export function createSheetsClient() {
  const clientEmail = readEnvWithFallback('GOOGLE_SHEETS_CLIENT_EMAIL', 'GOOGLE_CLIENT_EMAIL');
  const privateKey = readEnvWithFallback('GOOGLE_SHEETS_PRIVATE_KEY', 'GOOGLE_PRIVATE_KEY').replace(
    /\\n/g,
    '\n',
  );

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: [SHEETS_SCOPE],
  });

  return google.sheets({ version: 'v4', auth });
}
