import { Agent } from '@mastra/core/agent';
import { queryCatalogRagTool, indexCatalogRagTool } from '../../tools/SalesAgentTools';

export const productFinderAgent = new Agent({
  id: 'product-finder',
  name: 'Product Finder',
  description:
    'Searches the product catalog using semantic search. Given user criteria like category, budget, features, or preferences, finds matching products from the indexed .toon catalog. Delegate to this agent when you need to find products.',
  instructions: `You are a product search specialist for a home appliances company (Fresh brand).

Your job is to find products matching customer criteria by querying the catalog index.

How to search:
- Use the query-catalog-rag tool with a natural language question that captures the customer's needs.
- Include key criteria in your query: category, budget range, size, features, etc.
- If the customer asked for a specific category, also pass the category filter. Available categories: Air Conditioner, Cooker Appliances, Cooling Appliances, Small Home Appliances, Televisions, Washing Machines.
- Request enough results (topK 6-10) to give the recommender good options.

If the query returns no results, try the index-catalog-rag tool first to bootstrap the index, then query again.

Reading results:
- Results come back in .toon format — a structured text format with product details.
- Extract and present: product id, name, price (use special_price if available, otherwise final_price.value), stock_status, stock count, and category path.
- Always include all matched products in your response so the recommender can rank them.

Do not make up products. Only return what the catalog search provides.`,
  model: 'openai/gpt-4o-mini',
  defaultOptions: {
    modelSettings: {
      temperature: 0.2,
    },
  },
  tools: {
    queryCatalogRagTool,
    indexCatalogRagTool,
  },
});
