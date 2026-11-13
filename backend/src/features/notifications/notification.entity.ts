import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { NotificationChannel } from './notification-channel';
import { NotificationStatus } from './notification-status';

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'varchar', length: 10 })
  channel!: NotificationChannel;

  @Column({ type: 'varchar', length: 255 })
  recipient!: string;

  // Stored already converted to UTC; `timezone` keeps the zone the client used.
  @Column({ name: 'scheduled_at', type: 'timestamptz' })
  scheduledAt!: Date;

  @Column({ type: 'varchar', length: 64 })
  timezone!: string;

  @Column({ type: 'varchar', length: 10 })
  status!: NotificationStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
