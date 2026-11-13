import { ArgumentMetadata, ValidationPipe } from '@nestjs/common';

export class BodyValidationPipe extends ValidationPipe {
  constructor() {
    super({ transform: true, whitelist: true, forbidNonWhitelisted: true });
  }

  override async transform(value: unknown, metadata: ArgumentMetadata): Promise<unknown> {
    // Route parameters retain their raw text for feature-specific pipes, such as ProductIdPipe.
    if (metadata.type !== 'body') return value;
    return super.transform(value, metadata);
  }
}
