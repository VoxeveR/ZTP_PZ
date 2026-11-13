import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service';

/**
 * Background worker started with the application. Every interval it sends all due PENDING notifications.
 * The next run is scheduled only after the previous one finishes, so runs never overlap.
 */
@Injectable()
export class NotificationWorker implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(NotificationWorker.name);
  private readonly enabled: boolean;
  private readonly intervalMs: number;
  private timer?: NodeJS.Timeout;
  private running?: Promise<void>;
  private stopped = false;

  constructor(
    private readonly notifications: NotificationsService,
    config: ConfigService,
  ) {
    this.enabled = config.getOrThrow<boolean>('NOTIFICATION_WORKER_ENABLED');
    this.intervalMs = config.getOrThrow<number>('NOTIFICATION_WORKER_INTERVAL_MS');
  }

  onApplicationBootstrap(): void {
    if (!this.enabled) {
      this.logger.log('Notification worker is disabled');
      return;
    }
    this.logger.log(`Notification worker started; interval ${this.intervalMs} ms`);
    this.scheduleNextRun();
  }

  // Runs before the database connection closes, so an in-flight run can finish cleanly.
  async onModuleDestroy(): Promise<void> {
    this.stopped = true;
    clearTimeout(this.timer);
    await this.running;
  }

  private scheduleNextRun(): void {
    this.timer = setTimeout(() => {
      this.running = this.run().finally(() => {
        this.running = undefined;
        if (!this.stopped) this.scheduleNextRun();
      });
    }, this.intervalMs);
    this.timer.unref();
  }

  private async run(): Promise<void> {
    try {
      const processed = await this.notifications.processReady();
      if (processed) this.logger.log(`Processed ${processed} due notification(s)`);
    } catch (error) {
      this.logger.error('Notification worker run failed', error instanceof Error ? error.stack : String(error));
    }
  }
}
