import { Injectable } from '@nestjs/common';
import { NotificationChannel } from './notification-channel';
import { NotificationDeliveryService } from './notification-delivery.service';
import { Notification } from './notification.entity';

/** Chooses the delivery mechanism from the notification channel. */
@Injectable()
export class NotificationDispatcher {
  constructor(private readonly delivery: NotificationDeliveryService) {}

  dispatch(notification: Notification): Promise<void> {
    switch (notification.channel) {
      case NotificationChannel.EMAIL:
        return this.delivery.sendEmail(notification);
      case NotificationChannel.PUSH:
        return this.delivery.sendPush(notification);
      default: {
        const unsupported: never = notification.channel;
        throw new Error(`Unsupported notification channel: ${String(unsupported)}`);
      }
    }
  }
}
