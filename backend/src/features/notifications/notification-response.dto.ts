import { ApiProperty } from '@nestjs/swagger';
import { NotificationChannel } from './notification-channel';
import { NotificationStatus } from './notification-status';
import { Notification } from './notification.entity';

export class NotificationResponseDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'Product Keyboard1 is back in stock' })
  content!: string;

  @ApiProperty({ enum: NotificationChannel, example: NotificationChannel.EMAIL })
  channel!: NotificationChannel;

  @ApiProperty({ example: 'customer@example.com' })
  recipient!: string;

  @ApiProperty({ example: '2026-12-15T08:00:00.000Z', description: 'Planned send time in UTC.' })
  scheduledAt!: string;

  @ApiProperty({ example: 'Europe/Warsaw' })
  timezone!: string;

  @ApiProperty({ enum: NotificationStatus, example: NotificationStatus.PENDING })
  status!: NotificationStatus;

  @ApiProperty({ example: '2026-11-13T12:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({
    example: 'notif_q3KZx1m0bFJ8vYpTn4c2Rw7sHd9LuE6a',
    description: 'Technical operation ID: the Idempotency-Key header if the client sent one, otherwise generated.',
  })
  idempotencyKey!: string;
}

export function toNotificationResponse(notification: Notification): NotificationResponseDto {
  return {
    id: notification.id,
    content: notification.content,
    channel: notification.channel,
    recipient: notification.recipient,
    scheduledAt: notification.scheduledAt.toISOString(),
    timezone: notification.timezone,
    status: notification.status,
    createdAt: notification.createdAt.toISOString(),
    idempotencyKey: notification.idempotencyKey,
  };
}
