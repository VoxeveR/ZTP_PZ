import { Controller, Get, Header } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { ApiNotificationMetrics, ApiNotifications } from './notifications.openapi';

// Served at /metrics, outside the api/v1 prefix (see app.ts), where Prometheus scrapes by default.
@ApiNotifications()
@Controller('metrics')
export class NotificationsMetricsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  @ApiNotificationMetrics()
  metrics(): Promise<string> {
    return this.notifications.metrics();
  }
}
