import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { createSheetsClient, resolveSpreadsheetId } from './google-sheets-client';

const getSheetInputSchema = z
	.object({
		spreadsheetId: z.string().optional().describe('Google Spreadsheet ID'),
		sheetUrl: z.string().url().optional().describe('Full Google Sheet link'),
	})
	.refine(data => data.spreadsheetId || data.sheetUrl, {
		message: 'Provide either spreadsheetId or sheetUrl',
	});

const getSheetOutputSchema = z.object({
	spreadsheetId: z.string(),
	title: z.string(),
	locale: z.string().nullable(),
	timeZone: z.string().nullable(),
	sheets: z.array(
		z.object({
			sheetId: z.number().nullable(),
			title: z.string(),
			index: z.number().nullable(),
			rowCount: z.number().nullable(),
			columnCount: z.number().nullable(),
		}),
	),
});

export const getSheetTool = createTool({
	id: 'get-sheet',
	description: 'Get spreadsheet metadata (title, locale, tabs) using a sheet ID or URL',
	inputSchema: getSheetInputSchema,
	outputSchema: getSheetOutputSchema,
	execute: async inputData => {
		const spreadsheetId = resolveSpreadsheetId(inputData);
		const sheetsClient = createSheetsClient();

		const response = await sheetsClient.spreadsheets.get({
			spreadsheetId,
			fields:
				'spreadsheetId,properties(title,locale,timeZone),sheets(properties(sheetId,title,index,gridProperties(rowCount,columnCount)))',
		});

		const data = response.data;

		return {
			spreadsheetId: data.spreadsheetId ?? spreadsheetId,
			title: data.properties?.title ?? 'Untitled spreadsheet',
			locale: data.properties?.locale ?? null,
			timeZone: data.properties?.timeZone ?? null,
			sheets: (data.sheets ?? []).map(sheet => ({
				sheetId: sheet.properties?.sheetId ?? null,
				title: sheet.properties?.title ?? 'Untitled sheet',
				index: sheet.properties?.index ?? null,
				rowCount: sheet.properties?.gridProperties?.rowCount ?? null,
				columnCount: sheet.properties?.gridProperties?.columnCount ?? null,
			})),
		};
	},
});
