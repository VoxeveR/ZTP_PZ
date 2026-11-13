import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductsPersistenceModule } from '../products/products-persistence.module';
import { ProductExceptionFilter } from '../products/product-exception.filter';
import { ProductHistory } from './product-history.entity';
import { ProductHistoryRepository } from './product-history.repository';
import { ProductHistoryService } from './product-history.service';
import { ProductHistoryController } from './product-history.controller';

@Module({
  imports: [ProductsPersistenceModule, TypeOrmModule.forFeature([ProductHistory])],
  controllers: [ProductHistoryController],
  providers: [ProductHistoryRepository, ProductHistoryService, ProductExceptionFilter],
  exports: [ProductHistoryService],
})
export class ProductHistoryModule {}
