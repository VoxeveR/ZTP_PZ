import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { NotificationCreateDto } from './notification-create.dto';
import { NotificationResponseDto } from './notification-response.dto';
import { NotificationStatusUpdateDto } from './notification-status-update.dto';
import { ProcessReadyResponseDto } from './process-ready-response.dto';

function ApiNotificationId() {
  return applyDecorators(
    ApiParam({ name: 'id', schema: { type: 'integer', minimum: 1, maximum: 2147483647, example: 1 } }),
    ApiBadRequestResponse({ description: 'ID is not a valid positive PostgreSQL integer' }),
    ApiNotFoundResponse({ description: 'Notification does not exist' }),
  );
}

export function ApiNotifications() {
  return applyDecorators(ApiTags('notifications'));
}

export function ApiListNotifications() {
  return applyDecorators(
    ApiOperation({ summary: 'List all notifications' }),
    ApiOkResponse({ type: NotificationResponseDto, isArray: true }),
  );
}

export function ApiGetNotification() {
  return applyDecorators(
    ApiOperation({ summary: 'Get a notification by its ID' }),
    ApiNotificationId(),
    ApiOkResponse({ type: NotificationResponseDto }),
  );
}

export function ApiCreateNotification() {
  return applyDecorators(
    ApiOperation({
      summary: 'Schedule a notification',
      description:
        'scheduledAt is interpreted in the given time zone, stored in UTC, and the status starts as PENDING. ' +
        'Every notification gets a unique idempotencyKey. Send the optional Idempotency-Key header to make retries ' +
        'safe: repeating the same request with the same key returns the first notification (200) instead of a new one.',
    }),
    ApiHeader({
      name: 'Idempotency-Key',
      required: false,
      description: 'Client operation ID, 1–255 visible ASCII characters. Stored as the idempotencyKey.',
      example: 'order-1024-restock',
    }),
    ApiBody({ type: NotificationCreateDto }),
    ApiCreatedResponse({ type: NotificationResponseDto, description: 'Notification created' }),
    ApiOkResponse({
      type: NotificationResponseDto,
      description: 'Repeated request with the same Idempotency-Key: the existing notification, nothing created',
    }),
    ApiBadRequestResponse({
      description: 'Missing fields, wrong types, unknown channel, non-ISO date or malformed Idempotency-Key',
    }),
    ApiConflictResponse({ description: 'Idempotency-Key was already used for a different notification' }),
    ApiUnprocessableEntityResponse({ description: 'Empty content or recipient, invalid time zone, or a past date' }),
  );
}

export function ApiNotificationMetrics() {
  return applyDecorators(
    ApiOperation({
      summary: 'Notification metrics for Prometheus',
      description:
        'Prometheus text format, served at /metrics (outside /api/v1): notifications_{sent,failed,pending,cancelled}_total ' +
        'and notifications_by_channel{status,channel}.',
    }),
    ApiProduces('text/plain'),
    ApiOkResponse({
      schema: {
        type: 'string',
        example: 'notifications_sent_total 3\nnotifications_by_channel{status="SENT",channel="EMAIL"} 2',
      },
    }),
  );
}

export function ApiSendNotificationNow() {
  return applyDecorators(
    ApiOperation({
      summary: 'Send a notification now',
      description:
        'Executes a PENDING notification immediately, regardless of scheduledAt. The channel is chosen by the dispatcher (EMAIL → MailHog, PUSH → ntfy). The result is SENT, or FAILED if delivery fails.',
    }),
    ApiNotificationId(),
    ApiOkResponse({ type: NotificationResponseDto }),
    ApiUnprocessableEntityResponse({ description: 'Notification is not PENDING' }),
  );
}

export function ApiProcessReadyNotifications() {
  return applyDecorators(
    ApiOperation({
      summary: 'Process all due notifications',
      description:
        'Batch run of what the background worker does: executes every PENDING notification whose scheduledAt has passed.',
    }),
    ApiOkResponse({ type: ProcessReadyResponseDto }),
  );
}

export function ApiUpdateNotificationStatus() {
  return applyDecorators(
    ApiOperation({
      summary: 'Change the notification status',
      description: 'Only PENDING can change, to SENT, FAILED or CANCELLED. SENT, FAILED and CANCELLED are final.',
    }),
    ApiNotificationId(),
    ApiBody({ type: NotificationStatusUpdateDto }),
    ApiOkResponse({ type: NotificationResponseDto }),
    ApiUnprocessableEntityResponse({ description: 'Transition not allowed by the state machine' }),
  );
}
