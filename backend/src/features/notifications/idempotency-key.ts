import { BadRequestException } from '@nestjs/common';

/** Validates the optional Idempotency-Key header: 1-255 visible ASCII characters, no spaces. */
export function parseIdempotencyKey(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (!/^[\x21-\x7E]{1,255}$/.test(value)) {
    throw new BadRequestException('Idempotency-Key must be 1-255 visible ASCII characters without spaces');
  }
  return value;
}
