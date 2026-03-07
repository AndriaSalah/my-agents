import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { getSheetTool } from '../tools/get-sheet-tool';
import { indexSheetRagTool } from '../tools/index-sheet-rag-tool';
import { updateSheetTool } from '../tools/update-sheet-tool';

const baseSheetRefSchema = z
  .object({
    spreadsheetId: z.string().optional(),
    sheetUrl: z.string().url().optional(),
  })
  .refine(data => data.spreadsheetId || data.sheetUrl, {
    message: 'Provide either spreadsheetId or sheetUrl',
  });

const getAndIndexInputSchema = baseSheetRefSchema.extend({
  range: z.string().describe('Range to index, for example Sheet1!A1:F500'),
  hasHeaderRow: z.boolean().default(true),
});

const metadataOutputSchema = z.object({
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

const indexOutputSchema = z.object({
  spreadsheetId: z.string(),
  sheetName: z.string(),
  indexedRows: z.number(),
  skippedRows: z.number(),
  indexName: z.string(),
  vectorStore: z.string(),
});

const updateOutputSchema = z.object({
  spreadsheetId: z.string(),
  updatedRange: z.string().nullable(),
  updatedRows: z.number(),
  updatedColumns: z.number(),
  updatedCells: z.number(),
});

const getSheetStep = createStep(getSheetTool);
const indexAfterGetStep = createStep(indexSheetRagTool);

export const sheetGetAndIndexWorkflow = createWorkflow({
  id: 'sheet-get-and-index-workflow',
  inputSchema: getAndIndexInputSchema,
  outputSchema: z.object({
    metadata: metadataOutputSchema,
    indexing: indexOutputSchema,
  }),
})
  .map(async ({ inputData }) => ({
    spreadsheetId: inputData.spreadsheetId,
    sheetUrl: inputData.sheetUrl,
  }))
  .then(getSheetStep)
  .map(async ({ getInitData }) => {
    const init = getInitData() as z.infer<typeof getAndIndexInputSchema>;
    return {
      spreadsheetId: init.spreadsheetId,
      sheetUrl: init.sheetUrl,
      range: init.range,
      hasHeaderRow: init.hasHeaderRow,
    };
  })
  .then(indexAfterGetStep)
  .map(async ({ inputData, getStepResult }) => ({
    metadata: getStepResult(getSheetStep),
    indexing: inputData,
  }))
  .commit();

const updateInputSchema = baseSheetRefSchema.extend({
  range: z.string().describe('Range to update, for example Sheet1!B2:D2'),
  values: z.array(z.array(z.string())).describe('Values to write'),
  valueInputOption: z.enum(['RAW', 'USER_ENTERED']).default('USER_ENTERED'),
  reindexRange: z.string().optional().describe('Optional different range to reindex after update'),
  hasHeaderRow: z.boolean().default(true),
});

const updateStep = createStep(updateSheetTool);
const reindexAfterUpdateStep = createStep(indexSheetRagTool);

export const sheetUpdateAndReindexWorkflow = createWorkflow({
  id: 'sheet-update-and-reindex-workflow',
  inputSchema: updateInputSchema,
  outputSchema: z.object({
    updateResult: updateOutputSchema,
    indexing: indexOutputSchema,
  }),
})
  .map(async ({ inputData }) => ({
    spreadsheetId: inputData.spreadsheetId,
    sheetUrl: inputData.sheetUrl,
    range: inputData.range,
    values: inputData.values,
    valueInputOption: inputData.valueInputOption,
  }))
  .then(updateStep)
  .map(async ({ getInitData }) => {
    const init = getInitData() as z.infer<typeof updateInputSchema>;
    return {
      spreadsheetId: init.spreadsheetId,
      sheetUrl: init.sheetUrl,
      range: init.reindexRange ?? init.range,
      hasHeaderRow: init.hasHeaderRow,
    };
  })
  .then(reindexAfterUpdateStep)
  .map(async ({ inputData, getStepResult }) => ({
    updateResult: getStepResult(updateStep),
    indexing: inputData,
  }))
  .commit();
