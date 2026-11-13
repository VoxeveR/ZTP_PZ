import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Notification } from './notification.entity';

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

  findById(id: number, manager?: EntityManager, lock = false): Promise<Notification | null> {
    const notifications = manager?.getRepository(Notification) ?? this.notifications;
    return notifications.findOne({ where: { id }, lock: lock ? { mode: 'pessimistic_write' } : undefined });
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
