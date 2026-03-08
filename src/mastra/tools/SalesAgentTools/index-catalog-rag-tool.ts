import { embedMany } from 'ai';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import {
  catalogEmbeddingModel,
  CATALOG_VECTOR_INDEX,
  CATALOG_VECTOR_NAME,
  listToonFiles,
  loadToonProducts,
  categoryNameFromFile,
} from './catalog-rag-shared';

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

export const indexCatalogRagTool = createTool({
  id: 'index-catalog-rag',
  description:
    'Index product catalog .toon files into vector storage for semantic search. Run this to bootstrap or refresh the product index.',
  inputSchema,
  outputSchema,
  execute: async (inputData, context) => {
    const vectorStore = context?.mastra?.getVector(CATALOG_VECTOR_NAME);
    if (!vectorStore) {
      throw new Error(`Vector store '${CATALOG_VECTOR_NAME}' not found. Register it in src/mastra/index.ts`);
    }

    let files = listToonFiles();

    if (inputData.categoryFile) {
      files = files.filter(f => f.endsWith(inputData.categoryFile!));
      if (files.length === 0) {
        throw new Error(`Category file "${inputData.categoryFile}" not found in catalog directory.`);
      }
    }

    const allChunks: { id: string; text: string; categoryName: string }[] = [];

    for (const file of files) {
      const chunks = loadToonProducts(file);
      allChunks.push(...chunks);
    }

    if (allChunks.length === 0) {
      return {
        indexedProducts: 0,
        skippedProducts: 0,
        categories: files.map(f => categoryNameFromFile(f)),
        indexName: CATALOG_VECTOR_INDEX,
        vectorStore: CATALOG_VECTOR_NAME,
      };
    }

    const { embeddings } = await embedMany({
      model: catalogEmbeddingModel,
      values: allChunks.map(c => c.text),
    });

    try {
      await vectorStore.createIndex({
        indexName: CATALOG_VECTOR_INDEX,
        dimension: embeddings[0]?.length ?? 1536,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : '';
      if (!message.includes('already') && !message.includes('exists')) {
        throw error;
      }
    }

    await vectorStore.upsert({
      indexName: CATALOG_VECTOR_INDEX,
      ids: allChunks.map(c => `product:${c.id}`),
      vectors: embeddings,
      metadata: allChunks.map(c => ({
        productId: c.id,
        categoryName: c.categoryName,
        text: c.text,
      })),
    });

    const categories = [...new Set(allChunks.map(c => c.categoryName))];

    return {
      indexedProducts: allChunks.length,
      skippedProducts: 0,
      categories,
      indexName: CATALOG_VECTOR_INDEX,
      vectorStore: CATALOG_VECTOR_NAME,
    };
  },
});
