import { Injectable, Logger } from '@nestjs/common';
import { NotificationsRepository } from './notifications.repository';
import { NotificationCreateDto } from './notification-create.dto';
import { NotificationResponseDto, toNotificationResponse } from './notification-response.dto';
import { NotificationStatus } from './notification-status';
import { canTransition } from './notification-state-machine';
import { isValidTimezone, toUtc } from './notification-time';
import {
  NotificationNotFoundError,
  NotificationTransitionError,
  NotificationValidationError,
} from './notification.errors';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly notifications: NotificationsRepository) {}

  async findAll(): Promise<NotificationResponseDto[]> {
    const notifications = await this.notifications.findAll();
    return notifications.map(toNotificationResponse);
  }

  async findById(id: number): Promise<NotificationResponseDto> {
    const notification = await this.notifications.findById(id);
    if (!notification) throw new NotificationNotFoundError(`Notification with ID ${id} was not found`);
    return toNotificationResponse(notification);
  }

  async create(payload: NotificationCreateDto): Promise<NotificationResponseDto> {
    const scheduledAt = this.validate(payload);
    const notification = await this.notifications.create({
      content: payload.content,
      channel: payload.channel,
      recipient: payload.recipient,
      scheduledAt,
      timezone: payload.timezone,
      status: NotificationStatus.PENDING,
    });
    this.logger.log(`Created notification with ID ${notification.id} scheduled at ${scheduledAt.toISOString()}`);
    return toNotificationResponse(notification);
  }

  async updateStatus(id: number, status: NotificationStatus): Promise<NotificationResponseDto> {
    // The row lock makes the check and the write atomic, so two requests cannot both leave PENDING.
    const notification = await this.notifications.transaction(async (manager) => {
      const current = await this.notifications.findById(id, manager, true);
      if (!current) throw new NotificationNotFoundError(`Notification with ID ${id} was not found`);
      if (!canTransition(current.status, status)) {
        throw new NotificationTransitionError(`Transition from ${current.status} to ${status} is not allowed`);
      }
      current.status = status;
      return this.notifications.save(current, manager);
    });
    this.logger.log(`Notification ${id} changed status to ${status}`);
    return toNotificationResponse(notification);
  }

  /** Applies the domain rules and returns the send time converted to UTC. */
  private validate(payload: NotificationCreateDto): Date {
    if (!payload.content.trim()) throw new NotificationValidationError('Content must not be empty');
    if (!payload.recipient.trim()) throw new NotificationValidationError('Recipient must not be empty');
    if (!payload.timezone.trim()) throw new NotificationValidationError('Timezone is required');
    if (!isValidTimezone(payload.timezone)) {
      throw new NotificationValidationError(`Timezone ${payload.timezone} is not a valid IANA time zone`);
    }
    const scheduledAt = toUtc(payload.scheduledAt, payload.timezone);
    if (!scheduledAt) throw new NotificationValidationError('scheduledAt is not a valid date-time');
    if (scheduledAt.getTime() <= Date.now()) {
      throw new NotificationValidationError('scheduledAt must be in the future');
    }
    return scheduledAt;
  }
}
