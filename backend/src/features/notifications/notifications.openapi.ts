import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
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
        'scheduledAt is interpreted in the given time zone, stored in UTC, and the status starts as PENDING.',
    }),
    ApiBody({ type: NotificationCreateDto }),
    ApiCreatedResponse({ type: NotificationResponseDto }),
    ApiBadRequestResponse({ description: 'Missing fields, wrong types, unknown channel or non-ISO date' }),
    ApiUnprocessableEntityResponse({ description: 'Empty content or recipient, invalid time zone, or a past date' }),
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
