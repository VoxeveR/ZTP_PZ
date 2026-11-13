import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  UseFilters,
} from '@nestjs/common';
import { ProductResponseDto } from './product-response.dto';
import { ProductsService } from './products.service';
import { ProductIdPipe } from './product-id.pipe';
import {
  ApiCreateProduct,
  ApiDeleteProduct,
  ApiGetProduct,
  ApiListProducts,
  ApiPatchProduct,
  ApiProducts,
  ApiReplaceProduct,
} from './products.openapi';
import { ProductWriteDto } from './product-write.dto';
import { ProductExceptionFilter } from './product-exception.filter';
import { ProductPatchDto } from './product-patch.dto';

@ApiProducts()
@Controller('products')
@UseFilters(ProductExceptionFilter)
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @ApiListProducts()
  findAll(): Promise<ProductResponseDto[]> {
    return this.products.findAll();
  }

  @Get(':id')
  @ApiGetProduct()
  findById(@Param('id', ProductIdPipe) id: number): Promise<ProductResponseDto> {
    return this.products.findById(id);
  }

  @Post()
  @ApiCreateProduct()
  create(@Body() payload: ProductWriteDto): Promise<ProductResponseDto> {
    return this.products.create(payload);
  }

  @Put(':id')
  @ApiReplaceProduct()
  replace(@Param('id', ProductIdPipe) id: number, @Body() payload: ProductWriteDto): Promise<ProductResponseDto> {
    return this.products.replace(id, payload);
  }

  @Patch(':id')
  @ApiPatchProduct()
  patch(@Param('id', ProductIdPipe) id: number, @Body() payload: ProductPatchDto): Promise<ProductResponseDto> {
    return this.products.patch(id, payload);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiDeleteProduct()
  delete(@Param('id', ProductIdPipe) id: number): Promise<void> {
    return this.products.delete(id);
  }
}
