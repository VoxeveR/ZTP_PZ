import {
  BeforeApplicationShutdown,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

@Injectable()
export class LifecycleService
  implements OnModuleInit, OnApplicationBootstrap, OnModuleDestroy, BeforeApplicationShutdown, OnApplicationShutdown
{
  private readonly logger = new Logger(LifecycleService.name);

  onModuleInit(): void {
    this.logger.log('Lifecycle module initialized');
  }

  onApplicationBootstrap(): void {
    this.logger.log('Application initialized; preparing to listen for requests');
  }

  onModuleDestroy(): void {
    this.logger.log('Application teardown started');
  }

  beforeApplicationShutdown(signal?: string): void {
    this.logger.log(
      `Shutdown requested (${signal ?? 'app.close()'}); draining HTTP requests before releasing resources`,
    );
  }

  onApplicationShutdown(signal?: string): void {
    this.logger.log(`HTTP server closed (${signal ?? 'app.close()'}); running resource shutdown hooks`);
  }
}
