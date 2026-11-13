import { ApiProperty, getSchemaPath } from '@nestjs/swagger';
import { ProductResponseDto } from '../products/product-response.dto';
import { ProductHistoryAction } from './product-history.entity';
import { ProductHistoryState } from './product-history-state';

export class ProductHistoryResponseDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 1 })
  productId!: number;

  @ApiProperty({ enum: ProductHistoryAction, example: ProductHistoryAction.CREATE })
  action!: ProductHistoryAction;

  @ApiProperty({
    oneOf: [{ $ref: getSchemaPath(ProductResponseDto) }, { type: 'object', additionalProperties: false }],
    description: 'Full product snapshot before the change; {} for CREATE.',
  })
  previousState!: ProductHistoryState;

  @ApiProperty({
    oneOf: [{ $ref: getSchemaPath(ProductResponseDto) }, { type: 'object', additionalProperties: false }],
    description: 'Full product snapshot after the change; {} for DELETE.',
  })
  currentState!: ProductHistoryState;

  @ApiProperty({ type: String, format: 'date-time', example: '2026-10-24T10:00:00.000Z' })
  changedAt!: string;
}
