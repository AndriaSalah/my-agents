import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { indexCatalogRagTool } from '../tools/index-catalog-rag-tool';

const inputSchema = z.object({
  categoryFile: z
    .string()
    .optional()
    .describe('Specific .toon filename to index, e.g. "Air_Conditioner.toon". Omit to index all categories.'),
});

const outputSchema = z.object({
  indexedProducts: z.number(),
  skippedProducts: z.number(),
  categories: z.array(z.string()),
  indexName: z.string(),
  vectorStore: z.string(),
});

const indexStep = createStep(indexCatalogRagTool);

export const catalogIndexWorkflow = createWorkflow({
  id: 'catalog-index-workflow',
  inputSchema,
  outputSchema,
})
  .then(indexStep)
  .commit();
