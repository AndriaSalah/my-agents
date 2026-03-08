import { z } from 'zod';
import { createScorer } from '@mastra/core/evals';
import { createCompletenessScorer } from '@mastra/evals/scorers/prebuilt';
import {
  getAssistantMessageFromRunOutput,
  getUserMessageFromRunInput,
} from '@mastra/evals/scorers/utils';

export const salesCompletenessScorer = createCompletenessScorer();

export const salesDiscoveryAndRecommendationScorer = createScorer({
  id: 'sales-discovery-and-recommendation-scorer',
  name: 'Sales Discovery And Recommendation',
  description:
    'Checks if the sales assistant asks for missing shopping criteria and returns actionable recommendations.',
  type: 'agent',
  judge: {
    model: 'openai/gpt-4o',
    instructions:
      'You are a strict evaluator for a home-appliance sales assistant. ' +
      'Assess whether the assistant collects missing requirements and provides useful recommendations. ' +
      'Return only valid JSON matching the provided schema.',
  },
})
  .preprocess(({ run }) => {
    const userText = getUserMessageFromRunInput(run.input) || '';
    const assistantText = getAssistantMessageFromRunOutput(run.output) || '';
    return { userText, assistantText };
  })
  .analyze({
    description: 'Evaluate discovery quality and recommendation usefulness',
    outputSchema: z.object({
      intent: z.enum(['product-search', 'buy', 'other']),
      hasEnoughUserCriteria: z.boolean(),
      askedForMissingCriteria: z.boolean(),
      includesRecommendationContent: z.boolean(),
      responseIsActionable: z.boolean(),
      confidence: z.number().min(0).max(1).default(1),
      explanation: z.string().default(''),
    }),
    createPrompt: ({ results }) => `
Evaluate this sales-assistant exchange.

User message:
"""
${results.preprocessStepResult.userText}
"""

Assistant response:
"""
${results.preprocessStepResult.assistantText}
"""

Rules:
1) intent = "product-search" when user is browsing or comparing products; "buy" for purchase/cart intent; otherwise "other".
2) hasEnoughUserCriteria is true only if user gave enough shopping context (category or product type, budget, or clear preferences).
3) If criteria are insufficient for product search, assistant should ask for missing details.
4) includesRecommendationContent is true only if response includes product suggestions or concrete next-step options.
5) responseIsActionable should be true when the response helps user move toward a purchase decision.

Return JSON:
{
  "intent": "product-search|buy|other",
  "hasEnoughUserCriteria": boolean,
  "askedForMissingCriteria": boolean,
  "includesRecommendationContent": boolean,
  "responseIsActionable": boolean,
  "confidence": number,
  "explanation": string
}
`,
  })
  .generateScore(({ results }) => {
    const r = (results as any)?.analyzeStepResult || {};

    if (!r.responseIsActionable) {
      return 0;
    }

    const criteriaHandlingScore =
      r.hasEnoughUserCriteria || r.askedForMissingCriteria ? 0.45 : 0;
    const recommendationScore = r.includesRecommendationContent ? 0.45 : 0.25;
    const confidenceBonus = 0.1 * (r.confidence ?? 1);

    return Math.max(
      0,
      Math.min(1, criteriaHandlingScore + recommendationScore + confidenceBonus),
    );
  })
  .generateReason(({ results, score }) => {
    const r = (results as any)?.analyzeStepResult || {};
    return `Sales discovery/recommendation: intent=${r.intent ?? 'unknown'}, hasEnoughUserCriteria=${r.hasEnoughUserCriteria ?? false}, askedForMissingCriteria=${r.askedForMissingCriteria ?? false}, includesRecommendationContent=${r.includesRecommendationContent ?? false}, responseIsActionable=${r.responseIsActionable ?? false}, confidence=${r.confidence ?? 0}. Score=${score}. ${r.explanation ?? ''}`;
  });

export const salesCartSafetyScorer = createScorer({
  id: 'sales-cart-safety-scorer',
  name: 'Sales Cart Safety',
  description:
    'Validates that cart-related responses avoid ambiguity and confirm clear purchase actions.',
  type: 'agent',
  judge: {
    model: 'openai/gpt-4o',
    instructions:
      'You evaluate cart-handling safety for a sales assistant. ' +
      'If the user wants to buy but product selection is ambiguous, the assistant should request clarification. ' +
      'Return only valid JSON matching the provided schema.',
  },
})
  .preprocess(({ run }) => {
    const userText = getUserMessageFromRunInput(run.input) || '';
    const assistantText = getAssistantMessageFromRunOutput(run.output) || '';
    return { userText, assistantText };
  })
  .analyze({
    description: 'Assess safe handling of buy/add-to-cart interactions',
    outputSchema: z.object({
      buyIntent: z.boolean(),
      ambiguousSelection: z.boolean(),
      askedForClarification: z.boolean(),
      confirmsAdditionOrNextStep: z.boolean(),
      safeEnough: z.boolean(),
      explanation: z.string().default(''),
    }),
    createPrompt: ({ results }) => `
Evaluate cart safety for this exchange.

User message:
"""
${results.preprocessStepResult.userText}
"""

Assistant response:
"""
${results.preprocessStepResult.assistantText}
"""

Guidelines:
- buyIntent is true if the user asks to buy, order, checkout, or add to cart.
- ambiguousSelection is true when user does not clearly identify which product to buy.
- askedForClarification is true when assistant asks which product (or quantity/customer details) when needed.
- confirmsAdditionOrNextStep is true when assistant confirms cart addition or clearly explains the next required step.
- safeEnough is true when the assistant does not assume an unclear product choice.

Return JSON:
{
  "buyIntent": boolean,
  "ambiguousSelection": boolean,
  "askedForClarification": boolean,
  "confirmsAdditionOrNextStep": boolean,
  "safeEnough": boolean,
  "explanation": string
}
`,
  })
  .generateScore(({ results }) => {
    const r = (results as any)?.analyzeStepResult || {};

    if (!r.buyIntent) {
      return 1;
    }

    if (!r.safeEnough) {
      return 0;
    }

    let score = 0.4;
    if (r.ambiguousSelection) {
      score += r.askedForClarification ? 0.35 : 0;
    } else {
      score += 0.35;
    }
    score += r.confirmsAdditionOrNextStep ? 0.25 : 0;

    return Math.max(0, Math.min(1, score));
  })
  .generateReason(({ results, score }) => {
    const r = (results as any)?.analyzeStepResult || {};
    return `Sales cart safety: buyIntent=${r.buyIntent ?? false}, ambiguousSelection=${r.ambiguousSelection ?? false}, askedForClarification=${r.askedForClarification ?? false}, confirmsAdditionOrNextStep=${r.confirmsAdditionOrNextStep ?? false}, safeEnough=${r.safeEnough ?? false}. Score=${score}. ${r.explanation ?? ''}`;
  });

export const salesScorers = {
  salesCompletenessScorer,
  salesDiscoveryAndRecommendationScorer,
  salesCartSafetyScorer,
};