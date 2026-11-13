import { NotificationStatus } from './notification-status';

// PENDING is the only non-final state; SENT, FAILED and CANCELLED allow no further transitions.
export const ALLOWED_TRANSITIONS: Readonly<Record<NotificationStatus, ReadonlySet<NotificationStatus>>> = {
  [NotificationStatus.PENDING]: new Set([
    NotificationStatus.SENT,
    NotificationStatus.FAILED,
    NotificationStatus.CANCELLED,
  ]),
  [NotificationStatus.SENT]: new Set(),
  [NotificationStatus.FAILED]: new Set(),
  [NotificationStatus.CANCELLED]: new Set(),
};

export function canTransition(current: NotificationStatus, next: NotificationStatus): boolean {
  return ALLOWED_TRANSITIONS[current].has(next);
}
