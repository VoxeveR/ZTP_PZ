import { Injectable, Logger } from '@nestjs/common';
import { EntityManager, QueryFailedError } from 'typeorm';
import { ProductsRepository, ProductValues } from './products.repository';
import { ProductResponseDto } from './product-response.dto';
import { Product } from './product.entity';
import { ProductWriteDto } from './product-write.dto';
import { ProductPatchDto } from './product-patch.dto';
import { CategoriesService } from '../categories/categories.service';
import { ProductHistoryService } from '../product-history/product-history.service';
import { ProductHistoryAction } from '../product-history/product-history.entity';
import { buildProductSnapshot } from './product.snapshot';
import {
  ProductConflictError,
  ProductNotFoundError,
  ProductRelationNotFoundError,
  ProductValidationError,
} from './product.errors';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private readonly products: ProductsRepository,
    private readonly categories: CategoriesService,
    private readonly history: ProductHistoryService,
  ) {}

  async findAll(): Promise<ProductResponseDto[]> {
    const products = await this.products.findAll();
    this.logger.debug(`Retrieved ${products.length} products`);
    return products.map((product) => this.toResponse(product));
  }

  async findById(id: number): Promise<ProductResponseDto> {
    this.logger.debug(`Fetching product with ID ${id}`);
    const product = await this.products.findById(id);
    if (!product) {
      this.logger.warn(`Product with ID ${id} was not found`);
      throw new ProductNotFoundError(`Product with ID ${id} was not found`);
    }
    return this.toResponse(product);
  }

  async create(payload: ProductWriteDto): Promise<ProductResponseDto> {
    const product = await this.persist(() =>
      this.products.transaction(async (manager) => {
        const values = await this.validate(payload, undefined, manager);
        const created = await this.products.create(values, manager);
        const currentState = this.toResponse(created);
        await this.history.append(manager, created.id, ProductHistoryAction.CREATE, {}, currentState);
        return currentState;
      }),
    );
    this.logger.log(`Created product with ID ${product.id}`);
    return product;
  }

  async replace(id: number, payload: ProductWriteDto): Promise<ProductResponseDto> {
    const product = await this.change(id, ProductHistoryAction.REPLACE, () => payload);
    this.logger.log(`Replaced product with ID ${id}`);
    return product;
  }

  async patch(id: number, payload: ProductPatchDto): Promise<ProductResponseDto> {
    const product = await this.change(id, ProductHistoryAction.UPDATE, (current) => {
      if (Object.values(payload).every((value) => value === undefined)) {
        throw new ProductValidationError('PATCH must include at least one editable field');
      }
      // Validate the effective full state, especially the price when only the category changes.
      return {
        name: payload.name ?? current.name,
        price: payload.price ?? Number(current.price),
        quantity: payload.quantity ?? current.quantity,
        categoryId: payload.categoryId ?? current.category.id,
      };
    });
    this.logger.log(`Updated product with ID ${id}`);
    return product;
  }

  async delete(id: number): Promise<void> {
    await this.persist(() =>
      this.products.transaction(async (manager) => {
        const product = await this.products.findById(id, manager, true);
        if (!product) throw new ProductNotFoundError(`Product with ID ${id} was not found`);
        const previousState = this.toResponse(product);
        if (!(await this.products.delete(id, manager))) {
          throw new ProductNotFoundError(`Product with ID ${id} was not found`);
        }
        await this.history.append(manager, id, ProductHistoryAction.DELETE, previousState, {});
      }),
    );
    this.logger.log(`Deleted product with ID ${id}`);
  }

  private change(
    id: number,
    action: ProductHistoryAction.REPLACE | ProductHistoryAction.UPDATE,
    payload: (current: Product) => ProductWriteDto,
  ): Promise<ProductResponseDto> {
    return this.persist(() =>
      this.products.transaction(async (manager) => {
        // Serialize concurrent changes to keep each previous state equal to the preceding committed state.
        const current = await this.products.findById(id, manager, true);
        if (!current) throw new ProductNotFoundError(`Product with ID ${id} was not found`);
        const previousState = this.toResponse(current);
        const values = await this.validate(payload(current), id, manager);
        const updated = await this.products.replace(id, values, manager);
        if (!updated) throw new ProductNotFoundError(`Product with ID ${id} was not found`);
        const currentState = this.toResponse(updated);
        await this.history.append(manager, id, action, previousState, currentState);
        return currentState;
      }),
    );
  }

  private async validate(
    payload: ProductWriteDto,
    excludeId?: number,
    manager?: EntityManager,
  ): Promise<ProductValues> {
    const name = payload.name.normalize('NFC');
    if (!/^[\p{L}\p{Nd}]{3,20}$/u.test(name)) {
      throw new ProductValidationError('Product name must contain 3–20 letters or digits');
    }
    if (await this.products.nameExists(name, excludeId, manager)) {
      throw new ProductConflictError('Product name already exists');
    }
    const category = await this.categories.findById(payload.categoryId, manager);
    if (!category) throw new ProductRelationNotFoundError('Category does not exist');

    const cents = Math.round(payload.price * 100);
    if (
      cents < 0 ||
      cents > 9999999999 ||
      cents < Math.round(Number(category.minPrice) * 100) ||
      cents > Math.round(Number(category.maxPrice) * 100)
    ) {
      throw new ProductValidationError(
        `Price must be between ${category.minPrice} and ${category.maxPrice} for this category`,
      );
    }
    if (payload.quantity < 0 || payload.quantity > 2147483647) {
      throw new ProductValidationError('Quantity must be between 0 and 2147483647');
    }
    const forbiddenNames = await this.products.findForbiddenNames(manager);
    if (forbiddenNames.some((entry) => name.toLowerCase().includes(entry.name.normalize('NFC').toLowerCase()))) {
      throw new ProductValidationError('Product name contains a forbidden phrase');
    }
    return { name, price: payload.price.toFixed(2), quantity: payload.quantity, category };
  }

  private async persist<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      // The unique index also protects against simultaneous POST/PUT requests.
      if (error instanceof QueryFailedError) {
        const { code, constraint } = error.driverError as { code?: string; constraint?: string };
        if (code === '23505' && constraint === 'products_name_lower_unique') {
          throw new ProductConflictError('Product name already exists');
        }
        if (code === '23503') throw new ProductRelationNotFoundError('Category does not exist');
      }
      throw error;
    }
  }

  private toResponse(product: Product): ProductResponseDto {
    return buildProductSnapshot(product);
  }
}
