import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { NotificationConflictError, NotificationDomainError, NotificationNotFoundError } from './notification.errors';

@Catch(NotificationDomainError)
export class NotificationExceptionFilter implements ExceptionFilter<NotificationDomainError> {
  constructor(private readonly adapterHost: HttpAdapterHost) {}

  catch(exception: NotificationDomainError, host: ArgumentsHost): void {
    let status = HttpStatus.UNPROCESSABLE_ENTITY;
    if (exception instanceof NotificationNotFoundError) status = HttpStatus.NOT_FOUND;
    if (exception instanceof NotificationConflictError) status = HttpStatus.CONFLICT;

    this.adapterHost.httpAdapter.reply(
      host.switchToHttp().getResponse(),
      { statusCode: status, message: exception.message, error: HttpStatus[status] },
      status,
    );
  }
}
