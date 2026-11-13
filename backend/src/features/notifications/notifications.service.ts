import { randomBytes } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { EntityManager, QueryFailedError } from 'typeorm';
import { NotificationChannel } from './notification-channel';
import { NotificationsRepository } from './notifications.repository';
import { NotificationDispatcher } from './notification-dispatcher';
import { Notification } from './notification.entity';
import { NotificationCreateDto } from './notification-create.dto';
import { NotificationResponseDto, toNotificationResponse } from './notification-response.dto';
import { NotificationStatus } from './notification-status';
import { canTransition } from './notification-state-machine';
import { isValidTimezone, toUtc } from './notification-time';
import {
  NotificationConflictError,
  NotificationNotFoundError,
  NotificationTransitionError,
  NotificationValidationError,
} from './notification.errors';

export interface NotificationCreateResult {
  notification: NotificationResponseDto;
  /** True when an Idempotency-Key matched an earlier request and nothing new was created. */
  replayed: boolean;
}

export function generateIdempotencyKey(): string {
  return `notif_${randomBytes(24).toString('base64url')}`;
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof QueryFailedError && (error.driverError as { code?: string }).code === '23505';
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly notifications: NotificationsRepository,
    private readonly dispatcher: NotificationDispatcher,
  ) {}

  async findAll(): Promise<NotificationResponseDto[]> {
    const notifications = await this.notifications.findAll();
    return notifications.map(toNotificationResponse);
  }

  async findById(id: number): Promise<NotificationResponseDto> {
    const notification = await this.notifications.findById(id);
    if (!notification) throw new NotificationNotFoundError(`Notification with ID ${id} was not found`);
    return toNotificationResponse(notification);
  }

  /**
   * Creates a PENDING notification. With a client Idempotency-Key, a repeated request returns the
   * notification created by the first one (`replayed: true`) instead of creating another.
   */
  async create(payload: NotificationCreateDto, idempotencyKey?: string): Promise<NotificationCreateResult> {
    if (idempotencyKey) {
      const existing = await this.notifications.findByIdempotencyKey(idempotencyKey);
      if (existing) return this.replay(existing, payload);
    }
    const scheduledAt = this.validate(payload);
    try {
      const notification = await this.notifications.create({
        content: payload.content,
        channel: payload.channel,
        recipient: payload.recipient,
        scheduledAt,
        timezone: payload.timezone,
        status: NotificationStatus.PENDING,
        idempotencyKey: idempotencyKey ?? generateIdempotencyKey(),
      });
      this.logger.log(`Created notification with ID ${notification.id} scheduled at ${scheduledAt.toISOString()}`);
      return { notification: toNotificationResponse(notification), replayed: false };
    } catch (error) {
      // Two requests with the same key passed the lookup at once: the one that lost the insert replays the winner.
      if (idempotencyKey && isUniqueViolation(error)) {
        const existing = await this.notifications.findByIdempotencyKey(idempotencyKey);
        if (existing) return this.replay(existing, payload);
      }
      throw error;
    }
  }

  /** Prometheus text format: totals per status and counts per status and channel (zeros included). */
  async metrics(): Promise<string> {
    const counts = await this.notifications.countByStatusAndChannel();
    const count = (status: NotificationStatus, channel?: NotificationChannel) =>
      counts
        .filter((row) => row.status === status && (!channel || row.channel === channel))
        .reduce((sum, row) => sum + row.count, 0);

    const lines: string[] = [];
    for (const status of Object.values(NotificationStatus)) {
      const name = `notifications_${status.toLowerCase()}_total`;
      lines.push(
        `# HELP ${name} Number of ${status.toLowerCase()} notifications`,
        `# TYPE ${name} gauge`,
        `${name} ${count(status)}`,
      );
    }
    lines.push(
      '# HELP notifications_by_channel Number of notifications by status and channel',
      '# TYPE notifications_by_channel gauge',
    );
    for (const status of Object.values(NotificationStatus)) {
      for (const channel of Object.values(NotificationChannel)) {
        lines.push(`notifications_by_channel{status="${status}",channel="${channel}"} ${count(status, channel)}`);
      }
    }
    return `${lines.join('\n')}\n`;
  }

  private replay(existing: Notification, payload: NotificationCreateDto): NotificationCreateResult {
    const scheduledAt = toUtc(payload.scheduledAt, payload.timezone);
    const sameRequest =
      existing.content === payload.content &&
      existing.channel === payload.channel &&
      existing.recipient === payload.recipient &&
      existing.timezone === payload.timezone &&
      scheduledAt?.getTime() === existing.scheduledAt.getTime();
    if (!sameRequest) {
      throw new NotificationConflictError(
        `Idempotency-Key ${existing.idempotencyKey} was already used for a different notification (ID ${existing.id})`,
      );
    }
    this.logger.log(`Idempotent replay: returning notification ${existing.id}`);
    return { notification: toNotificationResponse(existing), replayed: true };
  }

  async updateStatus(id: number, status: NotificationStatus): Promise<NotificationResponseDto> {
    // The row lock makes the check and the write atomic, so two requests cannot both leave PENDING.
    const notification = await this.notifications.transaction(async (manager) => {
      const current = await this.notifications.findById(id, manager, 'wait');
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

  /** send-now: executes one PENDING notification immediately, regardless of scheduledAt. */
  async sendNow(id: number): Promise<NotificationResponseDto> {
    const notification = await this.notifications.transaction(async (manager) => {
      const current = await this.notifications.findById(id, manager, 'wait');
      if (!current) throw new NotificationNotFoundError(`Notification with ID ${id} was not found`);
      if (current.status !== NotificationStatus.PENDING) {
        throw new NotificationTransitionError(
          `Only PENDING notifications can be sent; notification ${id} is ${current.status}`,
        );
      }
      return this.execute(current, manager);
    });
    return toNotificationResponse(notification);
  }

  /** Executes every PENDING notification whose scheduledAt has passed. Returns how many were executed. */
  async processReady(): Promise<number> {
    const ids = await this.notifications.findReadyIds(new Date());
    let processed = 0;
    for (const id of ids) {
      const executed = await this.notifications.transaction(async (manager) => {
        // Skip rows that send-now or another run holds, and rows that changed since the list was read.
        const current = await this.notifications.findById(id, manager, 'skip');
        if (!current || current.status !== NotificationStatus.PENDING) return false;
        await this.execute(current, manager);
        return true;
      });
      if (executed) processed++;
    }
    return processed;
  }

  /** Dispatches a locked PENDING notification and records SENT or FAILED. */
  private async execute(notification: Notification, manager: EntityManager): Promise<Notification> {
    let next = NotificationStatus.SENT;
    try {
      await this.dispatcher.dispatch(notification);
    } catch (error) {
      next = NotificationStatus.FAILED;
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Notification ${notification.id} (${notification.channel}) failed: ${reason}`);
    }
    if (!canTransition(notification.status, next)) {
      throw new NotificationTransitionError(`Transition from ${notification.status} to ${next} is not allowed`);
    }
    notification.status = next;
    const saved = await this.notifications.save(notification, manager);
    this.logger.log(`Notification ${saved.id} (${saved.channel}) is ${saved.status}`);
    return saved;
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
