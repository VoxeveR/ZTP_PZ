import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { ProductsRepository } from '../products/products.repository';
import { ProductNotFoundError } from '../products/product.errors';
import { ProductHistoryRepository } from './product-history.repository';
import { ProductHistoryAction } from './product-history.entity';
import { ProductHistoryResponseDto } from './product-history-response.dto';
import { ProductHistoryState } from './product-history-state';

@Injectable()
export class ProductHistoryService {
  constructor(
    private readonly history: ProductHistoryRepository,
    private readonly products: ProductsRepository,
  ) {}

  async findByProductId(id: number): Promise<ProductHistoryResponseDto[]> {
    const entries = await this.history.findByProductId(id);
    if (entries.length === 0 && !await this.products.findById(id)) {
      throw new ProductNotFoundError(`Product with ID ${id} was not found`);
    }
    return entries.map((entry) => ({
      id: entry.id,
      productId: entry.productId,
      action: entry.action,
      previousState: entry.previousState,
      currentState: entry.currentState,
      changedAt: entry.changedAt.toISOString(),
    }));
  }

  append(
    manager: EntityManager,
    productId: number,
    action: ProductHistoryAction,
    previousState: ProductHistoryState,
    currentState: ProductHistoryState,
  ): Promise<void> {
    return this.history.append(manager, productId, action, previousState, currentState);
  }
}
