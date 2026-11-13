import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { NotificationStatus } from './notification-status';

export class NotificationStatusUpdateDto {
  @ApiProperty({ enum: NotificationStatus, example: NotificationStatus.CANCELLED })
  @IsEnum(NotificationStatus)
  status!: NotificationStatus;
}
