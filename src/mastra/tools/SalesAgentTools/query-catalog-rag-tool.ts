import { embed } from 'ai';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import {
  catalogEmbeddingModel,
  CATALOG_VECTOR_INDEX,
  CATALOG_VECTOR_NAME,
} from './catalog-rag-shared';

const inputSchema = z.object({
  question: z.string().describe('Natural language query to search for products, e.g. "energy efficient AC under 30000"'),
  category: z.string().optional().describe('Filter to a specific category name, e.g. "Air Conditioner"'),
  topK: z.number().int().min(1).max(20).default(8).describe('How many product matches to retrieve'),
});

const outputSchema = z.object({
  relevantContext: z.string(),
  totalMatches: z.number(),
  matches: z.array(
    z.object({
      id: z.string(),
      score: z.number(),
      productId: z.string().nullable(),
      categoryName: z.string().nullable(),
      text: z.string().nullable(),
    }),
  ),
});

export const queryCatalogRagTool = createTool({
  id: 'query-catalog-rag',
  description:
    'Semantic search over the indexed product catalog. Returns matching products as raw .toon text that includes name, price, stock, categories, and more.',
  inputSchema,
  outputSchema,
  execute: async (inputData, context) => {
    const vectorStore = context?.mastra?.getVector(CATALOG_VECTOR_NAME);
    if (!vectorStore) {
      throw new Error(`Vector store '${CATALOG_VECTOR_NAME}' not found. Register it in src/mastra/index.ts`);
    }

    const { embedding } = await embed({
      model: catalogEmbeddingModel,
      value: inputData.question,
    });

    const filter = inputData.category ? { categoryName: inputData.category } : undefined;

    const results = await vectorStore.query({
      indexName: CATALOG_VECTOR_INDEX,
      queryVector: embedding,
      topK: inputData.topK,
      filter,
    });

    const normalizedMatches = results.map(result => ({
      id: String(result.id),
      score: result.score,
      productId: (result.metadata?.productId as string | undefined) ?? null,
      categoryName: (result.metadata?.categoryName as string | undefined) ?? null,
      text: (result.metadata?.text as string | undefined) ?? result.document ?? null,
    }));

    return {
      relevantContext: normalizedMatches
        .map(match => match.text)
        .filter((text): text is string => Boolean(text))
        .join('\n\n---\n\n'),
      totalMatches: normalizedMatches.length,
      matches: normalizedMatches,
    };
  },
});
