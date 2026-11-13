import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, LessThanOrEqual, Repository } from 'typeorm';
import { Notification } from './notification.entity';
import { NotificationStatus } from './notification-status';

export type NotificationValues = Pick<
  Notification,
  'content' | 'channel' | 'recipient' | 'scheduledAt' | 'timezone' | 'status'
>;

@Injectable()
export class NotificationsRepository {
  constructor(@InjectRepository(Notification) private readonly notifications: Repository<Notification>) {}

  findAll(): Promise<Notification[]> {
    return this.notifications.find({ order: { id: 'ASC' } });
  }

  /**
   * `lock: 'wait'` locks the row and waits for other holders; `'skip'` returns null for a row
   * another transaction already holds (used by batch processing to avoid double sends).
   */
  findById(id: number, manager?: EntityManager, lock?: 'wait' | 'skip'): Promise<Notification | null> {
    const notifications = manager?.getRepository(Notification) ?? this.notifications;
    if (!lock) return notifications.findOne({ where: { id } });
    return notifications.findOne({
      where: { id },
      lock: { mode: 'pessimistic_write', onLocked: lock === 'skip' ? 'skip_locked' : undefined },
    });
  }

  async findReadyIds(now: Date): Promise<number[]> {
    const rows = await this.notifications.find({
      select: { id: true },
      where: { status: NotificationStatus.PENDING, scheduledAt: LessThanOrEqual(now) },
      order: { scheduledAt: 'ASC', id: 'ASC' },
    });
    return rows.map((row) => row.id);
  }

  create(values: NotificationValues): Promise<Notification> {
    return this.notifications.save(this.notifications.create(values));
  }

  save(notification: Notification, manager: EntityManager): Promise<Notification> {
    return manager.getRepository(Notification).save(notification);
  }

  transaction<T>(operation: (manager: EntityManager) => Promise<T>): Promise<T> {
    return this.notifications.manager.transaction(operation);
  }
}
