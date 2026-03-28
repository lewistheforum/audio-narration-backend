import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

// Extend dayjs with timezone support
dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Vietnam timezone constant
 */
export const VIETNAM_TIMEZONE = 'Asia/Ho_Chi_Minh';

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const HAS_TIMEZONE_REGEX = /(Z|[+-]\d{2}:\d{2})$/i;

function toVietnamDayjs(date?: Date | string | number): dayjs.Dayjs {
  if (date === undefined || date === null) {
    return dayjs().tz(VIETNAM_TIMEZONE);
  }

  if (typeof date === 'string') {
    const normalizedDate = date.trim();

    if (DATE_ONLY_REGEX.test(normalizedDate)) {
      return dayjs.tz(`${normalizedDate}T00:00:00`, VIETNAM_TIMEZONE);
    }

    if (HAS_TIMEZONE_REGEX.test(normalizedDate)) {
      return dayjs(normalizedDate).tz(VIETNAM_TIMEZONE);
    }

    return dayjs.tz(normalizedDate, VIETNAM_TIMEZONE);
  }

  return dayjs(date).tz(VIETNAM_TIMEZONE);
}

function normalizeTimeString(time: string): string {
  const normalizedTime = time.trim();

  if (/^\d{2}:\d{2}$/.test(normalizedTime)) {
    return `${normalizedTime}:00`;
  }

  return normalizedTime;
}

/**
 * Build a Date object from a Vietnam date and time.
 *
 * @param date - Base date value
 * @param time - Time in HH:mm or HH:mm:ss format
 * @returns Date object representing the exact Vietnam time
 */
export function buildVietnamDateTime(
  date: Date | string | number,
  time: string,
): Date {
  const vietnamDate = getDateString(date);
  const normalizedTime = normalizeTimeString(time);

  return dayjs.tz(`${vietnamDate}T${normalizedTime}`, VIETNAM_TIMEZONE).toDate();
}

/**
 * Get current time in Vietnam timezone as Date object
 *
 * @returns Date object representing current time in Vietnam (GMT+7)
 */
export function getCurrentVietnamTime(): Date {
  return toVietnamDayjs().toDate();
}

/**
 * Format a date to ISO 8601 string with Vietnam timezone offset (+07:00)
 *
 * @param date - Date to format (can be Date object, string, or undefined for current time)
 * @returns ISO 8601 string with +07:00 offset (e.g., "2026-03-10T21:25:09.075+07:00")
 */
export function formatToVietnamTime(date?: Date | string | number): string {
  return toVietnamDayjs(date).format();
}

/**
 * Parse ISO 8601 string to Date object, respecting Vietnam timezone
 *
 * @param isoString - ISO 8601 string with or without timezone
 * @returns Date object
 */
export function parseVietnamTime(isoString: string): Date {
  return toVietnamDayjs(isoString).toDate();
}

/**
 * Add time to current Vietnam time
 *
 * @param amount - Amount to add
 * @param unit - Unit of time ('second', 'minute', 'hour', 'day', etc.)
 * @returns Date object
 */
export function addToVietnamTime(
  amount: number,
  unit: dayjs.ManipulateType,
): Date {
  return toVietnamDayjs().add(amount, unit).toDate();
}

/**
 * Add time to a specific date in Vietnam timezone
 *
 * @param date - Base date
 * @param amount - Amount to add
 * @param unit - Unit of time
 * @returns Date object
 */
export function addToDate(
  date: Date | string,
  amount: number,
  unit: dayjs.ManipulateType,
): Date {
  return toVietnamDayjs(date).add(amount, unit).toDate();
}

/**
 * Get start of month for a date in Vietnam timezone
 *
 * @param date - Date object or string (can be YYYY-MM)
 * @returns Date object at YYYY-MM-01 00:00:00
 */
export function getStartOfMonth(date: Date | string): Date {
  return toVietnamDayjs(date).startOf('month').toDate();
}

/**
 * Get end of month for a date in Vietnam timezone
 *
 * @param date - Date object or string (can be YYYY-MM)
 * @returns Date object at YYYY-MM-last 23:59:59
 */
export function getEndOfMonth(date: Date | string): Date {
  return toVietnamDayjs(date).endOf('month').toDate();
}

/**
 * Check if a date is in the past (compared to current Vietnam time)
 *
 * @param date - Date to check
 * @returns true if date is in the past
 */
export function isInPast(date: Date | string): boolean {
  return toVietnamDayjs(date).isBefore(toVietnamDayjs());
}

/**
 * Get current time as ISO 8601 string with Vietnam timezone offset
 * REPLACES: new Date().toISOString()
 *
 * @returns ISO 8601 string with +07:00 offset
 */
export function getCurrentTime(): string {
  return formatToVietnamTime();
}

/**
 * Get timestamp in milliseconds (Vietnam timezone aware)
 * REPLACES: Date.now() or new Date(date).getTime()
 *
 * @param date - Optional date to get timestamp for
 * @returns Milliseconds since epoch
 */
export function getVietnamTimestamp(date?: Date | string | number): number {
  return toVietnamDayjs(date).valueOf();
}

/**
 * Get start of day (00:00:00) in Vietnam timezone
 *
 * @param date - Optional date (defaults to today)
 * @returns Date object at 00:00:00 Vietnam time
 */
export function getStartOfDay(date?: Date | string): Date {
  return toVietnamDayjs(date).startOf('day').toDate();
}

/**
 * Get start of tomorrow (00:00:00) in Vietnam timezone.
 *
 * @returns Date object at 00:00:00 tomorrow in Vietnam time
 */
export function getStartOfTomorrow(): Date {
  return toVietnamDayjs().add(1, 'day').startOf('day').toDate();
}

/**
 * Get start of a specific date in Vietnam timezone.
 *
 * @param date - Date or date string to normalize
 * @returns Date object at 00:00:00 of that date in Vietnam time
 */
export function getStartOfVietnamDate(date: Date | string | number): Date {
  return toVietnamDayjs(date).startOf('day').toDate();
}

/**
 * Check if a requested booking date is at least tomorrow in Vietnam timezone.
 *
 * @param date - Date or ISO string to validate
 * @returns true if the requested date is tomorrow or later in Vietnam time
 */
export function isAtLeastOneDayInAdvanceVietnam(
  date: Date | string | number,
): boolean {
  const requestedDate = toVietnamDayjs(date).startOf('day');
  const startOfTomorrow = toVietnamDayjs().add(1, 'day').startOf('day');

  return !requestedDate.isBefore(startOfTomorrow);
}

/**
 * Get end of day (23:59:59.999) in Vietnam timezone
 *
 * @param date - Optional date (defaults to today)
 * @returns Date object at 23:59:59.999 Vietnam time
 */
export function getEndOfDay(date?: Date | string): Date {
  return toVietnamDayjs(date).endOf('day').toDate();
}

/**
 * Get date in YYYY-MM-DD format (Vietnam timezone)
 *
 * @param date - Optional date (defaults to today)
 * @returns Date string in YYYY-MM-DD format
 */
export function getDateString(date?: Date | string | number): string {
  return toVietnamDayjs(date).format('YYYY-MM-DD');
}

/**
 * Subtract time from current Vietnam time
 *
 * @param amount - Amount to subtract
 * @param unit - Unit of time
 * @returns Date object
 */
export function subtractFromVietnamTime(
  amount: number,
  unit: dayjs.ManipulateType,
): Date {
  return toVietnamDayjs().subtract(amount, unit).toDate();
}

/**
 * Check if a date is today (Vietnam timezone)
 *
 * @param date - Date to check
 * @returns true if date is today
 */
export function isToday(date: Date | string): boolean {
  return toVietnamDayjs(date).startOf('day').isSame(toVietnamDayjs().startOf('day'));
}

/**
 * Check if a date is in the future (compared to current Vietnam time)
 *
 * @param date - Date to check
 * @returns true if date is in the future
 */
export function isInFuture(date: Date | string): boolean {
  return toVietnamDayjs(date).isAfter(toVietnamDayjs());
}

/**
 * Format date to YYYY-MM-DD in Vietnam timezone
 *
 * @param date - Date to format (defaults to current Vietnam time)
 * @returns Date string in YYYY-MM-DD format
 */
export function formatToDateOnly(date?: Date | string | number): string {
  return toVietnamDayjs(date).format('YYYY-MM-DD');
}

/**
 * Format date to HH:mm:ss in Vietnam timezone
 *
 * @param date - Date to format (defaults to current Vietnam time)
 * @returns Time string in HH:mm:ss format
 */
export function formatToTimeOnly(date?: Date | string | number): string {
  return toVietnamDayjs(date).format('HH:mm:ss');
}

/**
 * Compare two dates in Vietnam timezone
 *
 * @param date1 - First date
 * @param date2 - Second date
 * @returns -1 if date1 < date2, 0 if equal, 1 if date1 > date2
 */
export function compareDates(
  date1: Date | string,
  date2: Date | string,
): number {
  const d1 = toVietnamDayjs(date1);
  const d2 = d1.isAfter(date2) ? 1 : d1.isBefore(date2) ? -1 : 0;
  return d2;
}

/**
 * Get start of day in Vietnam timezone
 *
 * @param date - Date (defaults to current Vietnam time)
 * @returns Date object at 00:00:00 Vietnam time
 */
export function startOfDay(date?: Date | string): Date {
  return getStartOfDay(date);
}

/**
 * Get end of day in Vietnam timezone
 *
 * @param date - Date (defaults to current Vietnam time)
 * @returns Date object at 23:59:59.999 Vietnam time
 */
export function endOfDay(date?: Date | string): Date {
  return getEndOfDay(date);
}
