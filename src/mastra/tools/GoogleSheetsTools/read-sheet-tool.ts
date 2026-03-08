import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { createSheetsClient, resolveSpreadsheetId } from './google-sheets-client';

const readSheetInputSchema = z
	.object({
		spreadsheetId: z.string().optional().describe('Google Spreadsheet ID'),
		sheetUrl: z.string().url().optional().describe('Full Google Sheet link'),
		range: z.string().describe('A1 notation, e.g. Sheet1!A1:D50'),
		majorDimension: z
			.enum(['ROWS', 'COLUMNS'])
			.default('ROWS')
			.describe('Read values by rows or columns'),
	})
	.refine(data => data.spreadsheetId || data.sheetUrl, {
		message: 'Provide either spreadsheetId or sheetUrl',
	});

const readSheetOutputSchema = z.object({
	spreadsheetId: z.string(),
	range: z.string(),
	majorDimension: z.string().nullable(),
	rowCount: z.number(),
	values: z.array(z.array(z.string())),
});

export const readSheetTool = createTool({
	id: 'read-sheet',
	description: 'Read values from a Google Sheet range using a sheet ID or URL',
	inputSchema: readSheetInputSchema,
	outputSchema: readSheetOutputSchema,
	execute: async inputData => {
		const spreadsheetId = resolveSpreadsheetId(inputData);
		const sheetsClient = createSheetsClient();

		const response = await sheetsClient.spreadsheets.values.get({
			spreadsheetId,
			range: inputData.range,
			majorDimension: inputData.majorDimension,
		});

		const values = (response.data.values ?? []).map(row => row.map(value => String(value ?? '')));

		return {
			spreadsheetId,
			range: response.data.range ?? inputData.range,
			majorDimension: response.data.majorDimension ?? null,
			rowCount: values.length,
			values,
		};
	},
});
