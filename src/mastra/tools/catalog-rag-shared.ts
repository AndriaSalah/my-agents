import { ModelRouterEmbeddingModel } from '@mastra/core/llm';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, basename, dirname } from 'path';

export const CATALOG_VECTOR_NAME = 'catalogVector';
export const CATALOG_VECTOR_INDEX = 'catalog_products';
export const CATALOG_EMBEDDING_MODEL = 'openai/text-embedding-3-small';

export const catalogEmbeddingModel = new ModelRouterEmbeddingModel(CATALOG_EMBEDDING_MODEL);

function resolveCatalogDir(): string {
  // Walk up from __dirname looking for the source catalog directory.
  // Works in both dev mode (.mastra/output/tools/) and production build (.mastra/output/).
  let dir = __dirname;
  for (let i = 0; i < 10; i++) {
    const candidate = join(dir, 'src', 'mastra', 'public', 'product-cataloge');
    if (existsSync(candidate)) {
      return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  // Production build fallback: public/ is copied next to the output
  const buildDir = join(__dirname, '..', 'public', 'product-cataloge');
  if (existsSync(buildDir)) {
    return buildDir;
  }

  throw new Error(
    `product-cataloge directory not found. Started search from: ${__dirname}`,
  );
}

/**
 * Lists all .toon product files (excludes categories.toon).
 */
export function listToonFiles(): string[] {
  const catalogDir = resolveCatalogDir();
  return readdirSync(catalogDir)
    .filter(f => f.endsWith('.toon') && f !== 'categories.toon')
    .map(f => join(catalogDir, f));
}

/**
 * Derives a human-readable category name from a .toon filename.
 * e.g. "Air_Conditioner.toon" → "Air Conditioner"
 */
export function categoryNameFromFile(filePath: string): string {
  return basename(filePath, '.toon').replace(/_/g, ' ');
}

/**
 * Splits a .toon file's content into one chunk per product node.
 * Each chunk is the raw .toon text for that product, prefixed with the category name.
 * Only the `id` is extracted for use as a dedup key — everything else stays as raw text.
 */
export function chunkToonByProduct(
  fileContent: string,
  categoryName: string,
): { id: string; text: string; categoryName: string }[] {
  // Find where the nodes section starts (e.g. "    nodes[29]:")
  const nodesHeaderMatch = fileContent.match(/^(\s*)nodes\[\d+\]:\s*$/m);
  if (!nodesHeaderMatch) {
    return [];
  }

  const nodesStart = nodesHeaderMatch.index! + nodesHeaderMatch[0].length;
  const nodesSection = fileContent.slice(nodesStart);

  // Split on each top-level product node: "      - id: <number>"
  // Each node starts with "      - id:" at the same indentation level
  const nodeRegex = /^(\s+)- id: (\d+)/gm;
  const boundaries: { index: number; id: string }[] = [];

  let match: RegExpExecArray | null;
  while ((match = nodeRegex.exec(nodesSection)) !== null) {
    boundaries.push({ index: match.index, id: match[2] });
  }

  if (boundaries.length === 0) {
    return [];
  }

  const chunks: { id: string; text: string; categoryName: string }[] = [];

  for (let i = 0; i < boundaries.length; i++) {
    const start = boundaries[i].index;
    const end = i + 1 < boundaries.length ? boundaries[i + 1].index : nodesSection.length;
    const rawText = nodesSection.slice(start, end).trimEnd();

    chunks.push({
      id: boundaries[i].id,
      text: `[Category: ${categoryName}]\n${rawText}`,
      categoryName,
    });
  }

  return chunks;
}

/**
 * Reads a .toon file and returns all product chunks.
 */
export function loadToonProducts(filePath: string): { id: string; text: string; categoryName: string }[] {
  const content = readFileSync(filePath, 'utf-8');
  const categoryName = categoryNameFromFile(filePath);
  return chunkToonByProduct(content, categoryName);
}
