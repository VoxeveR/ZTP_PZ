import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Product } from './product.entity';
import { Category } from '../categories/category.entity';
import { ForbiddenProductName } from './forbidden-product-name.entity';

export interface ProductValues {
  name: string;
  price: string;
  quantity: number;
  category: Category;
}

@Injectable()
export class ProductsRepository {
  constructor(
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(ForbiddenProductName) private readonly forbiddenNames: Repository<ForbiddenProductName>,
  ) {}

  findAll(): Promise<Product[]> {
    return this.products.find({ relations: { category: true }, order: { id: 'ASC' } });
  }

  transaction<T>(operation: (manager: EntityManager) => Promise<T>): Promise<T> {
    return this.products.manager.transaction(operation);
  }

  findById(id: number, manager?: EntityManager, lock = false): Promise<Product | null> {
    const products = manager?.getRepository(Product) ?? this.products;
    if (lock) {
      return products
        .createQueryBuilder('product')
        .innerJoinAndSelect('product.category', 'category')
        .where('product.id = :id', { id })
        .setLock('pessimistic_write', undefined, ['product'])
        .getOne();
    }
    return products.findOne({ where: { id }, relations: { category: true } });
  }

  findForbiddenNames(manager?: EntityManager): Promise<ForbiddenProductName[]> {
    return (manager?.getRepository(ForbiddenProductName) ?? this.forbiddenNames).find();
  }

  async nameExists(name: string, excludeId?: number, manager?: EntityManager): Promise<boolean> {
    const query = (manager?.getRepository(Product) ?? this.products)
      .createQueryBuilder('product')
      .where('lower(product.name) = lower(:name)', { name });
    if (excludeId !== undefined) query.andWhere('product.id != :excludeId', { excludeId });
    return query.getExists();
  }

  create(values: ProductValues, manager?: EntityManager): Promise<Product> {
    const products = manager?.getRepository(Product) ?? this.products;
    return products.save(products.create(values));
  }

  async replace(id: number, values: ProductValues, manager?: EntityManager): Promise<Product | null> {
    // UPDATE cannot accidentally recreate a product deleted by a concurrent request.
    const result = await (manager?.getRepository(Product) ?? this.products).update(id, values);
    return result.affected ? this.findById(id, manager) : null;
  }

  async delete(id: number, manager?: EntityManager): Promise<boolean> {
    const result = await (manager?.getRepository(Product) ?? this.products).delete(id);
    return !!result.affected;
  }
}
