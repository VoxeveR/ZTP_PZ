import { Body, Controller, Get, Param, Patch, Post, UseFilters } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationCreateDto } from './notification-create.dto';
import { NotificationResponseDto } from './notification-response.dto';
import { NotificationStatusUpdateDto } from './notification-status-update.dto';
import { NotificationIdPipe } from './notification-id.pipe';
import { NotificationExceptionFilter } from './notification-exception.filter';
import {
  ApiCreateNotification,
  ApiGetNotification,
  ApiListNotifications,
  ApiNotifications,
  ApiUpdateNotificationStatus,
} from './notifications.openapi';

@ApiNotifications()
@Controller('notifications')
@UseFilters(NotificationExceptionFilter)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Post()
  @ApiCreateNotification()
  create(@Body() payload: NotificationCreateDto): Promise<NotificationResponseDto> {
    return this.notifications.create(payload);
  }

  @Get()
  @ApiListNotifications()
  findAll(): Promise<NotificationResponseDto[]> {
    return this.notifications.findAll();
  }

  @Get(':id')
  @ApiGetNotification()
  findById(@Param('id', NotificationIdPipe) id: number): Promise<NotificationResponseDto> {
    return this.notifications.findById(id);
  }

  @Patch(':id/status')
  @ApiUpdateNotificationStatus()
  updateStatus(
    @Param('id', NotificationIdPipe) id: number,
    @Body() payload: NotificationStatusUpdateDto,
  ): Promise<NotificationResponseDto> {
    return this.notifications.updateStatus(id, payload.status);
  }
}
