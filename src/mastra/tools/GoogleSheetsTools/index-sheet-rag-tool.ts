import { embedMany } from 'ai';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { createSheetsClient, resolveSpreadsheetId } from './google-sheets-client';
import {
  buildRowText,
  getSheetNameFromRange,
  sanitizeSheetName,
  sheetEmbeddingModel,
  SHEET_VECTOR_INDEX,
  SHEET_VECTOR_NAME,
} from './sheet-rag-shared';

const inputSchema = z
  .object({
    spreadsheetId: z.string().optional().describe('Google Spreadsheet ID'),
    sheetUrl: z.string().url().optional().describe('Full Google Sheet URL'),
    range: z.string().describe('A1 notation range to index, for example Sheet1!A1:F500'),
    hasHeaderRow: z.boolean().default(true).describe('When true, row 1 is treated as column headers'),
  })
  .refine(data => data.spreadsheetId || data.sheetUrl, {
    message: 'Provide either spreadsheetId or sheetUrl',
  });

const outputSchema = z.object({
  spreadsheetId: z.string(),
  sheetName: z.string(),
  indexedRows: z.number(),
  skippedRows: z.number(),
  indexName: z.string(),
  vectorStore: z.string(),
});

export const indexSheetRagTool = createTool({
  id: 'index-sheet-rag',
  description:
    'Index sheet rows into vector storage for semantic search (RAG). Run this after sheet updates to refresh knowledge.',
  inputSchema,
  outputSchema,
  execute: async (inputData, context) => {
    const spreadsheetId = resolveSpreadsheetId(inputData);
    const sheetsClient = createSheetsClient();
    const sheetName = getSheetNameFromRange(inputData.range);

    const vectorStore = context?.mastra?.getVector(SHEET_VECTOR_NAME);
    if (!vectorStore) {
      throw new Error(`Vector store '${SHEET_VECTOR_NAME}' not found. Register it in src/mastra/index.ts`);
    }

    const valuesResponse = await sheetsClient.spreadsheets.values.get({
      spreadsheetId,
      range: inputData.range,
      majorDimension: 'ROWS',
    });

    const rows = (valuesResponse.data.values ?? []).map(row => row.map(value => String(value ?? '')));

    if (rows.length === 0) {
      return {
        spreadsheetId,
        sheetName,
        indexedRows: 0,
        skippedRows: 0,
        indexName: SHEET_VECTOR_INDEX,
        vectorStore: SHEET_VECTOR_NAME,
      };
    }

    const headers = inputData.hasHeaderRow
      ? (rows[0] ?? []).map((header, index) => header || `column_${index + 1}`)
      : Array.from({ length: Math.max(...rows.map(row => row.length), 0) }, (_, index) => `column_${index + 1}`);

    const startRow = inputData.hasHeaderRow ? 1 : 0;
    const rowItems = rows
      .slice(startRow)
      .map((row, rowOffset) => {
        const rowNumber = startRow + rowOffset + 1;
        const isEmpty = row.every(cell => cell.trim() === '');
        if (isEmpty) {
          return null;
        }

        const text = buildRowText(headers, row, sheetName, rowNumber);
        const id = `${spreadsheetId}:${sanitizeSheetName(sheetName)}:${rowNumber}`;

        return {
          id,
          text,
          metadata: {
            spreadsheetId,
            sheetName,
            rowNumber,
            sourceRange: inputData.range,
            text,
          },
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    if (rowItems.length === 0) {
      return {
        spreadsheetId,
        sheetName,
        indexedRows: 0,
        skippedRows: rows.length - startRow,
        indexName: SHEET_VECTOR_INDEX,
        vectorStore: SHEET_VECTOR_NAME,
      };
    }

    const { embeddings } = await embedMany({
      model: sheetEmbeddingModel,
      values: rowItems.map(item => item.text),
    });

    try {
      await vectorStore.createIndex({
        indexName: SHEET_VECTOR_INDEX,
        dimension: embeddings[0]?.length ?? 1536,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : '';
      if (!message.includes('already') && !message.includes('exists')) {
        throw error;
      }
    }

    await vectorStore.upsert({
      indexName: SHEET_VECTOR_INDEX,
      ids: rowItems.map(item => item.id),
      vectors: embeddings,
      metadata: rowItems.map(item => item.metadata),
    });

    const skippedRows = rows.length - startRow - rowItems.length;

    return {
      spreadsheetId,
      sheetName,
      indexedRows: rowItems.length,
      skippedRows: Math.max(0, skippedRows),
      indexName: SHEET_VECTOR_INDEX,
      vectorStore: SHEET_VECTOR_NAME,
    };
  },
});
