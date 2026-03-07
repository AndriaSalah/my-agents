
import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore, LibSQLVector } from '@mastra/libsql';
import { Observability, DefaultExporter, CloudExporter, SensitiveDataFilter } from '@mastra/observability';
import { weatherWorkflow } from './workflows/weather-workflow';

import { weatherAgent } from './agents/weather-agent';
import { salesAgent } from './agents/sales-agent';
import { productFinderAgent } from './agents/product-finder-agent';
import { productRecommenderAgent } from './agents/product-recommender-agent';
import { toolCallAppropriatenessScorer, completenessScorer, translationScorer } from './scorers/weather-scorer';
import { sheetsAgent } from './agents/sheets-agent';
import {
  sheetsCompletenessScorer,
  sheetsRequestHandlingScorer,
  sheetsUpdateSafetyScorer,
} from './scorers/sheets-scorer';
import { sheetGetAndIndexWorkflow, sheetUpdateAndReindexWorkflow } from './workflows/sheets-rag-sync-workflow';
import { catalogIndexWorkflow } from './workflows/catalog-index-workflow';

export const mastra = new Mastra({
  workflows: { weatherWorkflow, sheetGetAndIndexWorkflow, sheetUpdateAndReindexWorkflow, catalogIndexWorkflow },
  agents: { weatherAgent, sheetsAgent, salesAgent },
  scorers: {
    toolCallAppropriatenessScorer,
    completenessScorer,
    translationScorer,
    sheetsCompletenessScorer,
    sheetsRequestHandlingScorer,
    sheetsUpdateSafetyScorer,
  },
  storage: new LibSQLStore({
    id: "mastra-storage",
    // stores observability, scores, ... into persistent file storage
    url: "file:./mastra.db",
  }),
  vectors: {
    sheetVector: new LibSQLVector({
      id: 'sheet-vector',
      url: 'file:./mastra.db',
    }),
    catalogVector: new LibSQLVector({
      id: 'catalog-vector',
      url: 'file:./mastra.db',
    }),
  },
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'mastra',
        exporters: [
          new DefaultExporter(), // Persists traces to storage for Mastra Studio
          // new CloudExporter(), // Sends traces to Mastra Cloud (if MASTRA_CLOUD_ACCESS_TOKEN is set)
        ],
        spanOutputProcessors: [
          new SensitiveDataFilter(), // Redacts sensitive data like passwords, tokens, keys
        ],
      },
    },
  }),
});
