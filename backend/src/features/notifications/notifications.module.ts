import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './notification.entity';
import { NotificationsRepository } from './notifications.repository';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationExceptionFilter } from './notification-exception.filter';
import { NotificationDeliveryService } from './notification-delivery.service';
import { NotificationDispatcher } from './notification-dispatcher';
import { NotificationWorker } from './notification-worker';
import { NotificationsMetricsController } from './notifications-metrics.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Notification])],
  controllers: [NotificationsController, NotificationsMetricsController],
  providers: [
    NotificationsRepository,
    NotificationsService,
    NotificationExceptionFilter,
    NotificationDeliveryService,
    NotificationDispatcher,
    NotificationWorker,
  ],
})
export class NotificationsModule {}
