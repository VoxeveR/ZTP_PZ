import { DateTime, IANAZone } from 'luxon';

export function isValidTimezone(name: string): boolean {
  return IANAZone.isValidZone(name);
}

/**
 * Converts the requested send time to UTC. A value without an offset is local time in `timezone`;
 * a value with an offset (e.g. `Z`) already names an exact moment, so `timezone` does not shift it.
 */
export function toUtc(scheduledAt: string, timezone: string): Date | null {
  const local = DateTime.fromISO(scheduledAt, { zone: timezone });
  return local.isValid ? local.toUTC().toJSDate() : null;
}
