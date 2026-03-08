import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

type CartLine = {
  productId: string;
  quantity: number;
};

const inMemoryCarts = new Map<string, CartLine[]>();

const inputSchema = z.object({
  customerId: z.string().default('guest'),
  productId: z.string().describe('Catalog product ID, e.g. "98" or "955"'),
  quantity: z.number().int().min(1).max(20).default(1),
});

const outputSchema = z.object({
  customerId: z.string(),
  added: z.object({
    productId: z.string(),
    quantity: z.number(),
  }),
  cartItems: z.array(
    z.object({
      productId: z.string(),
      quantity: z.number(),
    }),
  ),
  totalLines: z.number(),
  totalQuantity: z.number(),
  message: z.string(),
});

export const salesAddToCartTool = createTool({
  id: 'sales-add-to-cart',
  description: 'Mock tool that adds a selected product to a customer cart.',
  inputSchema,
  outputSchema,
  execute: async inputData => {
    const existing = inMemoryCarts.get(inputData.customerId) ?? [];
    const line = existing.find(item => item.productId === inputData.productId);

    if (line) {
      line.quantity += inputData.quantity;
    } else {
      existing.push({
        productId: inputData.productId,
        quantity: inputData.quantity,
      });
    }

    inMemoryCarts.set(inputData.customerId, existing);

    const totalQuantity = existing.reduce((sum, item) => sum + item.quantity, 0);

    return {
      customerId: inputData.customerId,
      added: {
        productId: inputData.productId,
        quantity: inputData.quantity,
      },
      cartItems: existing,
      totalLines: existing.length,
      totalQuantity,
      message: `Added ${inputData.quantity} x ${inputData.productId} to cart for ${inputData.customerId}.`,
    };
  },
});
