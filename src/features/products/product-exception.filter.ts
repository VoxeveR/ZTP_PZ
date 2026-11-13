import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import {
  ProductConflictError,
  ProductDomainError,
  ProductNotFoundError,
  ProductRelationNotFoundError,
} from './product.errors';

@Catch(ProductDomainError)
export class ProductExceptionFilter implements ExceptionFilter<ProductDomainError> {
  constructor(private readonly adapterHost: HttpAdapterHost) {}

  catch(exception: ProductDomainError, host: ArgumentsHost): void {
    let status = HttpStatus.UNPROCESSABLE_ENTITY;
    if (exception instanceof ProductConflictError) status = HttpStatus.CONFLICT;
    if (exception instanceof ProductRelationNotFoundError) status = HttpStatus.BAD_REQUEST;
    if (exception instanceof ProductNotFoundError) status = HttpStatus.NOT_FOUND;

    this.adapterHost.httpAdapter.reply(
      host.switchToHttp().getResponse(),
      { statusCode: status, message: exception.message, error: HttpStatus[status] },
      status,
    );
  }
}
