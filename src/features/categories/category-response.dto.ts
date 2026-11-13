import { ApiProperty } from '@nestjs/swagger';

export class CategoryResponseDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'Electronics' })
  name!: string;

  @ApiProperty({ type: String, example: '10.00' })
  minPrice!: string;

  @ApiProperty({ type: String, example: '100000.00' })
  maxPrice!: string;
}
