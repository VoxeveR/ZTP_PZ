import { Transform } from 'class-transformer';
import { IsInt, IsNumber, IsString, Max, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ProductWriteDto {
  @ApiProperty({ example: 'Keyboard1', minLength: 3, maxLength: 20,
    description: 'Unique name, letters and digits only. Forbidden phrases are rejected.' })
  @IsString()
  name!: string;

  @ApiProperty({
    oneOf: [{ type: 'number' }, { type: 'string', pattern: '^\\d+(\\.\\d{1,2})?$' }],
    example: '149.90',
    description: 'Price with at most two decimal places, within the category limits (inclusive).',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && /^-?\d+(\.\d{1,2})?$/.test(value) ? Number(value) : value,
  )
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 })
  price!: number;

  @ApiProperty({ example: 10, minimum: 0, maximum: 2147483647 })
  @IsInt()
  quantity!: number;

  @ApiProperty({ example: 1, minimum: 1, maximum: 2147483647 })
  @IsInt()
  @Min(1)
  @Max(2147483647)
  categoryId!: number;
}
