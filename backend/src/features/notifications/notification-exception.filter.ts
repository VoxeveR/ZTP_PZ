import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { NotificationDomainError, NotificationNotFoundError } from './notification.errors';

@Catch(NotificationDomainError)
export class NotificationExceptionFilter implements ExceptionFilter<NotificationDomainError> {
  constructor(private readonly adapterHost: HttpAdapterHost) {}

  catch(exception: NotificationDomainError, host: ArgumentsHost): void {
    const status =
      exception instanceof NotificationNotFoundError ? HttpStatus.NOT_FOUND : HttpStatus.UNPROCESSABLE_ENTITY;

    this.adapterHost.httpAdapter.reply(
      host.switchToHttp().getResponse(),
      { statusCode: status, message: exception.message, error: HttpStatus[status] },
      status,
    );
  }
}
