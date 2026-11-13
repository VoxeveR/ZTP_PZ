import { Controller, Get, Param, UseFilters } from '@nestjs/common';
import { ProductIdPipe } from '../products/product-id.pipe';
import { ProductExceptionFilter } from '../products/product-exception.filter';
import { ProductHistoryService } from './product-history.service';
import { ProductHistoryResponseDto } from './product-history-response.dto';
import { ApiGetProductHistory, ApiProductHistory } from './product-history.openapi';

@ApiProductHistory()
@Controller('products/:id/history')
@UseFilters(ProductExceptionFilter)
export class ProductHistoryController {
  constructor(private readonly history: ProductHistoryService) {}

  @Get()
  @ApiGetProductHistory()
  findByProductId(@Param('id', ProductIdPipe) id: number): Promise<ProductHistoryResponseDto[]> {
    return this.history.findByProductId(id);
  }
}
