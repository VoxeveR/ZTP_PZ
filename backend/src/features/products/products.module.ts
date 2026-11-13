import { Module } from '@nestjs/common';
import { CategoriesModule } from '../categories/categories.module';
import { ProductHistoryModule } from '../product-history/product-history.module';
import { ProductsPersistenceModule } from './products-persistence.module';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { ProductExceptionFilter } from './product-exception.filter';

@Module({
  imports: [ProductsPersistenceModule, CategoriesModule, ProductHistoryModule],
  controllers: [ProductsController],
  providers: [ProductsService, ProductExceptionFilter],
})
export class ProductsModule {}
