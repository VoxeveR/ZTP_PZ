import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsISO8601, IsString } from 'class-validator';
import { NotificationChannel } from './notification-channel';

export class NotificationCreateDto {
  @ApiProperty({ example: 'Product Keyboard1 is back in stock' })
  @IsString()
  content!: string;

  @ApiProperty({ enum: NotificationChannel, example: NotificationChannel.EMAIL })
  @IsEnum(NotificationChannel)
  channel!: NotificationChannel;

  @ApiProperty({ example: 'customer@example.com', description: 'E-mail address (EMAIL) or ntfy topic (PUSH).' })
  @IsString()
  recipient!: string;

  @ApiProperty({
    example: '2026-12-15T09:00:00',
    description:
      'ISO 8601 date-time. Without an offset it is local time in `timezone`; with an offset (e.g. `Z`) it is that exact moment. Must be in the future.',
  })
  @IsISO8601({ strict: true })
  scheduledAt!: string;

  @ApiProperty({ example: 'Europe/Warsaw', description: 'IANA time zone name.' })
  @IsString()
  timezone!: string;
}
