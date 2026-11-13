import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { ProductResponseDto } from './product-response.dto';
import { ProductWriteDto } from './product-write.dto';
import { ProductPatchDto } from './product-patch.dto';

function ApiProductId() {
  return ApiParam({
    name: 'id',
    schema: { type: 'integer', minimum: 1, maximum: 2147483647, example: 1 },
  });
}

function ApiProductWrite(type: typeof ProductWriteDto | typeof ProductPatchDto = ProductWriteDto) {
  return applyDecorators(
    ApiBody({ type }),
    ApiBadRequestResponse({ description: 'Invalid payload, ID, or missing category' }),
    ApiConflictResponse({ description: 'A product with this name already exists (case-insensitive)' }),
    ApiUnprocessableEntityResponse({ description: 'Name, forbidden phrase, category price range, or quantity validation failed' }),
  );
}

export function ApiProducts() {
  return applyDecorators(ApiTags('products'));
}

export function ApiListProducts() {
  return applyDecorators(
    ApiOperation({ summary: 'List all products with categories and prices' }),
    ApiOkResponse({ type: ProductResponseDto, isArray: true }),
  );
}

export function ApiGetProduct() {
  return applyDecorators(
    ApiOperation({ summary: 'Get a product by its unique ID' }),
    ApiProductId(),
    ApiOkResponse({ type: ProductResponseDto }),
    ApiBadRequestResponse({ description: 'ID is not a valid positive PostgreSQL integer' }),
    ApiNotFoundResponse({ description: 'Product does not exist' }),
  );
}

export function ApiCreateProduct() {
  return applyDecorators(
    ApiOperation({ summary: 'Create a product', description: 'All four fields are required. Price limits are inclusive and come from the category.' }),
    ApiProductWrite(),
    ApiCreatedResponse({ type: ProductResponseDto }),
  );
}

export function ApiReplaceProduct() {
  return applyDecorators(
    ApiOperation({ summary: 'Replace all editable product fields', description: 'PUT requires name, price, quantity, and categoryId; the product ID remains unchanged.' }),
    ApiProductId(),
    ApiProductWrite(),
    ApiOkResponse({ type: ProductResponseDto }),
    ApiNotFoundResponse({ description: 'Product does not exist' }),
  );
}

export function ApiDeleteProduct() {
  return applyDecorators(
    ApiOperation({ summary: 'Delete a product' }),
    ApiProductId(),
    ApiNoContentResponse({ description: 'Product deleted; no response body' }),
    ApiBadRequestResponse({ description: 'ID is not a valid positive PostgreSQL integer' }),
    ApiNotFoundResponse({ description: 'Product does not exist' }),
  );
}

export function ApiPatchProduct() {
  return applyDecorators(
    ApiOperation({ summary: 'Update selected product fields', description: 'At least one field is required. Omitted fields are preserved; null is rejected. The resulting state is validated and recorded as UPDATE.' }),
    ApiProductId(),
    ApiProductWrite(ProductPatchDto),
    ApiOkResponse({ type: ProductResponseDto }),
    ApiNotFoundResponse({ description: 'Product does not exist' }),
  );
}

