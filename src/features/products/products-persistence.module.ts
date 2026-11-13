import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoriesModule } from '../categories/categories.module';
import { Product } from './product.entity';
import { ForbiddenProductName } from './forbidden-product-name.entity';
import { ProductsRepository } from './products.repository';

// Shared by product operations and history lookups without a circular module dependency.
@Module({
  imports: [CategoriesModule, TypeOrmModule.forFeature([Product, ForbiddenProductName])],
  providers: [ProductsRepository],
  exports: [ProductsRepository],
})
export class ProductsPersistenceModule {}
