import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiExtraModels,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ProductResponseDto } from '../products/product-response.dto';
import { ProductHistoryResponseDto } from './product-history-response.dto';

export function ApiProductHistory() {
  return applyDecorators(ApiTags('product-history'));
}

export function ApiGetProductHistory() {
  return applyDecorators(
    ApiOperation({ summary: 'List product history, newest first', description: 'Includes full before/after snapshots and remains available after deletion. Existing products without recorded changes return an empty array.' }),
    ApiParam({ name: 'id', schema: { type: 'integer', minimum: 1, maximum: 2147483647, example: 1 } }),
    ApiExtraModels(ProductResponseDto),
    ApiOkResponse({ type: ProductHistoryResponseDto, isArray: true }),
    ApiBadRequestResponse({ description: 'ID is not a valid positive PostgreSQL integer' }),
    ApiNotFoundResponse({ description: 'Neither the product nor its history exists' }),
  );
}
