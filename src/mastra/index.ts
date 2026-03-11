
import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { QdrantVector } from '@mastra/qdrant';
import { Observability, DefaultExporter, SensitiveDataFilter } from '@mastra/observability';
import { weatherWorkflow } from './workflows/weather-workflow';

import { weatherAgent } from './agents/weather-agent';
import { salesAgent } from './agents/Sales-agent/sales-agent';
import { toolCallAppropriatenessScorer, completenessScorer, translationScorer } from './scorers/weather-scorer';
import {
  salesCompletenessScorer,
  salesDiscoveryAndRecommendationScorer,
  salesCartSafetyScorer,
} from './scorers/sales-scorer';
import { catalogIndexWorkflow } from './workflows/catalog-index-workflow';

const qdrantEndpoint = process.env.QDRANT_ENDPOINT;
const qdrantApiKey = process.env.QDRANT_API_KEY;

if (!qdrantEndpoint) {
  throw new Error('Missing QDRANT_ENDPOINT. Set it in .env to use Qdrant for sales catalog vectors.');
}

export const mastra = new Mastra({  
  workflows: { weatherWorkflow, catalogIndexWorkflow },
  agents: { weatherAgent, salesAgent },
  scorers: {
    toolCallAppropriatenessScorer,
    completenessScorer,
    translationScorer,
    salesCompletenessScorer,
    salesDiscoveryAndRecommendationScorer,
    salesCartSafetyScorer,
  },
  storage: new LibSQLStore({
    id: "mastra-storage",
    // stores observability, scores, ... into persistent file storage
    url: "file:./mastra.db",
  }),
  vectors: {
    catalogVector: new QdrantVector({
      id: 'catalog-vector',
      url: qdrantEndpoint,
      apiKey: qdrantApiKey,
    }),
  },
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'debug',
  }),
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'mastra',
        exporters: [
          new DefaultExporter({
            logLevel:"debug",
          }), // Persists traces to storage for Mastra Studio
          // new CloudExporter(), // Sends traces to Mastra Cloud (if MASTRA_CLOUD_ACCESS_TOKEN is set)
        ],
        spanOutputProcessors: [
          new SensitiveDataFilter(), // Redacts sensitive data like passwords, tokens, keys
        ],
      },
    },
  }),
});
