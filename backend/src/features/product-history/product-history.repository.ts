import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { ProductHistory, ProductHistoryAction } from './product-history.entity';
import { ProductHistoryState } from './product-history-state';

@Injectable()
export class ProductHistoryRepository {
  constructor(@InjectRepository(ProductHistory) private readonly history: Repository<ProductHistory>) {}

  findByProductId(productId: number): Promise<ProductHistory[]> {
    return this.history.find({ where: { productId }, order: { changedAt: 'DESC', id: 'DESC' } });
  }

  async append(
    manager: EntityManager,
    productId: number,
    action: ProductHistoryAction,
    previousState: ProductHistoryState,
    currentState: ProductHistoryState,
  ): Promise<void> {
    // A transaction manager is required so the audit entry commits with its product change.
    await manager.getRepository(ProductHistory).insert({ productId, action, previousState, currentState });
  }
}
