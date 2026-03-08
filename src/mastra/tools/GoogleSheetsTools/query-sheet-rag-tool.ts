import { embed } from 'ai';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { extractSpreadsheetIdFromUrl } from './google-sheets-client';
import {
  sheetEmbeddingModel,
  SHEET_VECTOR_INDEX,
  SHEET_VECTOR_NAME,
} from './sheet-rag-shared';

const inputSchema = z.object({
  question: z.string().describe('Natural language question to search for in indexed sheet rows'),
  spreadsheetId: z.string().optional().describe('Filter retrieval to one spreadsheet ID'),
  sheetUrl: z.string().url().optional().describe('Optional Google Sheet URL, used to extract spreadsheet ID'),
  topK: z.number().int().min(1).max(20).default(5).describe('How many matches to retrieve'),
});

const outputSchema = z.object({
  relevantContext: z.string(),
  totalMatches: z.number(),
  matches: z.array(
    z.object({
      id: z.string(),
      score: z.number(),
      spreadsheetId: z.string().nullable(),
      sheetName: z.string().nullable(),
      rowNumber: z.number().nullable(),
      text: z.string().nullable(),
    }),
  ),
});

function getOptionalSpreadsheetId(input: { spreadsheetId?: string; sheetUrl?: string }) {
  if (input.spreadsheetId?.trim()) {
    return input.spreadsheetId.trim();
  }

  if (input.sheetUrl?.trim()) {
    return extractSpreadsheetIdFromUrl(input.sheetUrl.trim());
  }

  return null;
}

export const querySheetRagTool = createTool({
  id: 'query-sheet-rag',
  description:
    'Semantic search over indexed sheet rows. Use this first for question answering over large sheets.',
  inputSchema,
  outputSchema,
  execute: async (inputData, context) => {
    const vectorStore = context?.mastra?.getVector(SHEET_VECTOR_NAME);
    if (!vectorStore) {
      throw new Error(`Vector store '${SHEET_VECTOR_NAME}' not found. Register it in src/mastra/index.ts`);
    }

    const { embedding } = await embed({
      model: sheetEmbeddingModel,
      value: inputData.question,
    });

    const optionalSpreadsheetId = getOptionalSpreadsheetId(inputData);

    const results = await vectorStore.query({
      indexName: SHEET_VECTOR_INDEX,
      queryVector: embedding,
      topK: inputData.topK,
      filter: optionalSpreadsheetId ? { spreadsheetId: optionalSpreadsheetId } : undefined,
    });

    const normalizedMatches = results.map(result => ({
      id: result.id,
      score: result.score,
      spreadsheetId: (result.metadata?.spreadsheetId as string | undefined) ?? null,
      sheetName: (result.metadata?.sheetName as string | undefined) ?? null,
      rowNumber:
        typeof result.metadata?.rowNumber === 'number' ? (result.metadata.rowNumber as number) : null,
      text: (result.metadata?.text as string | undefined) ?? result.document ?? null,
    }));

    return {
      relevantContext: normalizedMatches
        .map(match => match.text)
        .filter((text): text is string => Boolean(text))
        .join('\n\n'),
      totalMatches: normalizedMatches.length,
      matches: normalizedMatches,
    };
  },
});
