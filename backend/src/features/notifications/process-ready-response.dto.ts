import { ApiProperty } from '@nestjs/swagger';

export class ProcessReadyResponseDto {
  @ApiProperty({ example: 2, description: 'Number of due PENDING notifications executed in this run.' })
  processedCount!: number;
}
