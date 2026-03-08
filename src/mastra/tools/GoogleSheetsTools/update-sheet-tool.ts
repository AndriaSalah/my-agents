import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { createSheetsClient, resolveSpreadsheetId } from './google-sheets-client';

const updateSheetInputSchema = z
	.object({
		spreadsheetId: z.string().optional().describe('Google Spreadsheet ID'),
		sheetUrl: z.string().url().optional().describe('Full Google Sheet link'),
		range: z.string().describe('A1 notation, e.g. Sheet1!B2:D2'),
		values: z.array(z.array(z.string())).describe('2D array of cell values to write'),
		valueInputOption: z
			.enum(['RAW', 'USER_ENTERED'])
			.default('USER_ENTERED')
			.describe('RAW writes exactly, USER_ENTERED lets Sheets parse numbers/formulas'),
	})
	.refine(data => data.spreadsheetId || data.sheetUrl, {
		message: 'Provide either spreadsheetId or sheetUrl',
	});

const updateSheetOutputSchema = z.object({
	spreadsheetId: z.string(),
	updatedRange: z.string().nullable(),
	updatedRows: z.number(),
	updatedColumns: z.number(),
	updatedCells: z.number(),
});

export const updateSheetTool = createTool({
	id: 'update-sheet',
	description: 'Update values in a Google Sheet range using a sheet ID or URL',
	inputSchema: updateSheetInputSchema,
	outputSchema: updateSheetOutputSchema,
	execute: async inputData => {
		const spreadsheetId = resolveSpreadsheetId(inputData);
		const sheetsClient = createSheetsClient();

		const response = await sheetsClient.spreadsheets.values.update({
			spreadsheetId,
			range: inputData.range,
			valueInputOption: inputData.valueInputOption,
			requestBody: {
				range: inputData.range,
				majorDimension: 'ROWS',
				values: inputData.values,
			},
		});

		return {
			spreadsheetId,
			updatedRange: response.data.updatedRange ?? null,
			updatedRows: response.data.updatedRows ?? 0,
			updatedColumns: response.data.updatedColumns ?? 0,
			updatedCells: response.data.updatedCells ?? 0,
		};
	},
});
