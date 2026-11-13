import { ApiProperty } from '@nestjs/swagger';
import { CategoryResponseDto } from '../categories/category-response.dto';

export class ProductResponseDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'Laptop' })
  name!: string;

  @ApiProperty({
    type: String,
    example: '3499.99',
    description: 'Exact decimal price with two fractional digits.',
    pattern: '^\\d+\\.\\d{2}$',
  })
  price!: string;

  @ApiProperty({ example: 10, minimum: 0, maximum: 2147483647 })
  quantity!: number;

  @ApiProperty({ type: CategoryResponseDto })
  category!: CategoryResponseDto;
}
