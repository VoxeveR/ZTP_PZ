import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Res,
  UseFilters,
} from '@nestjs/common';
import { ProcessReadyResponseDto } from './process-ready-response.dto';
import { parseIdempotencyKey } from './idempotency-key';
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
  ApiProcessReadyNotifications,
  ApiSendNotificationNow,
  ApiUpdateNotificationStatus,
} from './notifications.openapi';

// The two response methods used for an idempotent replay (Express response).
interface ReplayableResponse {
  status(code: number): unknown;
  setHeader(name: string, value: string): unknown;
}

@ApiNotifications()
@Controller('notifications')
@UseFilters(NotificationExceptionFilter)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Post()
  @ApiCreateNotification()
  async create(
    @Body() payload: NotificationCreateDto,
    @Headers('idempotency-key') idempotencyKeyHeader: string | undefined,
    @Res({ passthrough: true }) response: ReplayableResponse,
  ): Promise<NotificationResponseDto> {
    const result = await this.notifications.create(payload, parseIdempotencyKey(idempotencyKeyHeader));
    if (result.replayed) {
      response.status(HttpStatus.OK);
      response.setHeader('Idempotent-Replayed', 'true');
    }
    return result.notification;
  }

  @Post('process-ready')
  @HttpCode(HttpStatus.OK)
  @ApiProcessReadyNotifications()
  async processReady(): Promise<ProcessReadyResponseDto> {
    return { processedCount: await this.notifications.processReady() };
  }

  @Post(':id/send-now')
  @HttpCode(HttpStatus.OK)
  @ApiSendNotificationNow()
  sendNow(@Param('id', NotificationIdPipe) id: number): Promise<NotificationResponseDto> {
    return this.notifications.sendNow(id);
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
