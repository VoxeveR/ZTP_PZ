import type { ProductSnapshot } from '../products/product.snapshot';

export type ProductHistoryState = ProductSnapshot | Record<string, never>;
