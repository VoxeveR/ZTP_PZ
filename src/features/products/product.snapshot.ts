import { Product } from './product.entity';

export interface ProductSnapshot {
  id: number;
  name: string;
  price: string;
  quantity: number;
  category: { id: number; name: string; minPrice: string; maxPrice: string };
}

export function buildProductSnapshot(product: Product): ProductSnapshot {
  return {
    id: product.id,
    name: product.name,
    price: product.price,
    quantity: product.quantity,
    category: {
      id: product.category.id,
      name: product.category.name,
      minPrice: product.category.minPrice,
      maxPrice: product.category.maxPrice,
    },
  };
}
