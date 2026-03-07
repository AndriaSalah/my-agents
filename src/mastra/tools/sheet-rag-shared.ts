import { ModelRouterEmbeddingModel } from '@mastra/core/llm';

export const SHEET_VECTOR_NAME = 'sheetVector';
export const SHEET_VECTOR_INDEX = 'sheet_rows';
export const SHEET_EMBEDDING_MODEL = 'openai/text-embedding-3-small';

export const sheetEmbeddingModel = new ModelRouterEmbeddingModel(SHEET_EMBEDDING_MODEL);

export function getSheetNameFromRange(range: string): string {
  const beforeBang = range.split('!')[0]?.trim();
  if (!beforeBang) {
    return 'Sheet';
  }

  return beforeBang.replace(/^'/, '').replace(/'$/, '') || 'Sheet';
}

export function sanitizeSheetName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]+/g, '_');
}

export function buildRowText(headers: string[], row: string[], sheetName: string, rowNumber: number): string {
  const pairs = row.map((value, index) => {
    const header = headers[index] || `column_${index + 1}`;
    return `${header}: ${value}`;
  });

  return `sheet=${sheetName}; row=${rowNumber}; ${pairs.join(' | ')}`;
}
