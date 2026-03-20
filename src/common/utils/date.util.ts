import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';

// Extend dayjs with timezone support
dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Vietnam timezone constant
 */
export const VIETNAM_TIMEZONE = 'Asia/Ho_Chi_Minh';

/**
 * Get current time in Vietnam timezone as Date object
 * 
 * @returns Date object representing current time in Vietnam (GMT+7)
 */
export function getCurrentVietnamTime(): Date {
  return dayjs().tz(VIETNAM_TIMEZONE).utc(true).toDate();
}

/**
 * Format a date to ISO 8601 string with Vietnam timezone offset (+07:00)
 * 
 * @param date - Date to format (can be Date object, string, or undefined for current time)
 * @returns ISO 8601 string with +07:00 offset (e.g., "2026-03-10T21:25:09.075+07:00")
 * 
 * @example
 * formatToVietnamTime() // "2026-03-10T21:25:09.075+07:00"
 * formatToVietnamTime(new Date()) // "2026-03-10T21:25:09.075+07:00"
 * formatToVietnamTime("2026-03-10T14:25:09.075Z") // "2026-03-10T21:25:09.075+07:00"
 */
export function formatToVietnamTime(date?: Date | string | number): string {
  if (!date) {
    return dayjs().tz(VIETNAM_TIMEZONE).format();
  }
  return dayjs(date).tz(VIETNAM_TIMEZONE).format();
}

/**
 * Parse ISO 8601 string to Date object, respecting Vietnam timezone
 * 
 * @param isoString - ISO 8601 string with or without timezone
 * @returns Date object
 * 
 * @example
 * parseVietnamTime("2026-03-10T21:25:09.075+07:00")
 * parseVietnamTime("2026-03-10T14:25:09.075Z") // Will be converted to Vietnam time
 */
export function parseVietnamTime(isoString: string): Date {
  return dayjs(isoString).tz(VIETNAM_TIMEZONE).utc(true).toDate();
}

/**
 * Add time to current Vietnam time
 * 
 * @param amount - Amount to add
 * @param unit - Unit of time ('second', 'minute', 'hour', 'day', etc.)
 * @returns Date object
 * 
 * @example
 * addToVietnamTime(30, 'minute') // Current Vietnam time + 30 minutes
 * addToVietnamTime(1, 'day') // Current Vietnam time + 1 day
 */
export function addToVietnamTime(
  amount: number,
  unit: dayjs.ManipulateType,
): Date {
  return dayjs().tz(VIETNAM_TIMEZONE).add(amount, unit).utc(true).toDate();
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
  return dayjs(date).tz(VIETNAM_TIMEZONE).add(amount, unit).utc(true).toDate();
}

/**
 * Check if a date is in the past (compared to current Vietnam time)
 * 
 * @param date - Date to check
 * @returns true if date is in the past
 */
export function isInPast(date: Date | string): boolean {
  const vietnamNow = dayjs().tz(VIETNAM_TIMEZONE);
  const targetDate = dayjs(date).tz(VIETNAM_TIMEZONE);
  return targetDate.isBefore(vietnamNow);
}

/**
 * Get current time as ISO 8601 string with Vietnam timezone offset
 * REPLACES: new Date().toISOString()
 * 
 * @returns ISO 8601 string with +07:00 offset
 * 
 * @example
 * getCurrentTime() // "2026-03-10T21:25:09.075+07:00"
 */
export function getCurrentTime(): string {
  return dayjs().tz(VIETNAM_TIMEZONE).format();
}

/**
 * Get timestamp in milliseconds (Vietnam timezone aware)
 * REPLACES: Date.now() or new Date(date).getTime()
 * 
 * @param date - Optional date to get timestamp for
 * @returns Milliseconds since epoch
 * 
 * @example
 * getVietnamTimestamp() // Current timestamp
 * getVietnamTimestamp("2026-03-10") // Specific date timestamp
 */
export function getVietnamTimestamp(date?: Date | string | number): number {
  if (!date) {
    return dayjs().tz(VIETNAM_TIMEZONE).valueOf();
  }
  return dayjs(date).tz(VIETNAM_TIMEZONE).valueOf();
}

/**
 * Get start of day (00:00:00) in Vietnam timezone
 * 
 * @param date - Optional date (defaults to today)
 * @returns Date object at 00:00:00 Vietnam time
 * 
 * @example
 * getStartOfDay() // Today at 00:00:00 +07:00
 * getStartOfDay("2026-03-15") // 2026-03-15 at 00:00:00 +07:00
 */
export function getStartOfDay(date?: Date | string): Date {
  if (!date) {
    return dayjs().tz(VIETNAM_TIMEZONE).startOf('day').utc(true).toDate();
  }
  return dayjs(date).tz(VIETNAM_TIMEZONE).startOf('day').utc(true).toDate();
}

/**
 * Get end of day (23:59:59.999) in Vietnam timezone
 * 
 * @param date - Optional date (defaults to today)
 * @returns Date object at 23:59:59.999 Vietnam time
 */
export function getEndOfDay(date?: Date | string): Date {
  if (!date) {
    return dayjs().tz(VIETNAM_TIMEZONE).endOf('day').utc(true).toDate();
  }
  return dayjs(date).tz(VIETNAM_TIMEZONE).endOf('day').utc(true).toDate();
}

/**
 * Get date in YYYY-MM-DD format (Vietnam timezone)
 * 
 * @param date - Optional date (defaults to today)
 * @returns Date string in YYYY-MM-DD format
 * 
 * @example
 * getDateString() // "2026-03-10"
 * getDateString("2026-03-15T10:30:00Z") // "2026-03-15"
 */
export function getDateString(date?: Date | string): string {
  if (!date) {
    return dayjs().tz(VIETNAM_TIMEZONE).format('YYYY-MM-DD');
  }
  return dayjs(date).tz(VIETNAM_TIMEZONE).format('YYYY-MM-DD');
}

/**
 * Subtract time from current Vietnam time
 * 
 * @param amount - Amount to subtract
 * @param unit - Unit of time
 * @returns Date object
 * 
 * @example
 * subtractFromVietnamTime(6, 'month') // 6 months ago
 */
export function subtractFromVietnamTime(
  amount: number,
  unit: dayjs.ManipulateType,
): Date {
  return dayjs().tz(VIETNAM_TIMEZONE).subtract(amount, unit).utc(true).toDate();
}

/**
 * Check if a date is today (Vietnam timezone)
 * 
 * @param date - Date to check
 * @returns true if date is today
 */
export function isToday(date: Date | string): boolean {
  const today = dayjs().tz(VIETNAM_TIMEZONE).startOf('day');
  const targetDate = dayjs(date).tz(VIETNAM_TIMEZONE).startOf('day');
  return targetDate.isSame(today);
}

/**
 * Check if a date is in the future (compared to current Vietnam time)
 * 
 * @param date - Date to check
 * @returns true if date is in the future
 */
export function isInFuture(date: Date | string): boolean {
  const vietnamNow = dayjs().tz(VIETNAM_TIMEZONE);
  const targetDate = dayjs(date).tz(VIETNAM_TIMEZONE);
  return targetDate.isAfter(vietnamNow);
}

/**
 * Format date to YYYY-MM-DD in Vietnam timezone
 * 
 * @param date - Date to format (defaults to current Vietnam time)
 * @returns Date string in YYYY-MM-DD format
 */
export function formatToDateOnly(date?: Date | string): string {
  if (!date) {
    return dayjs().tz(VIETNAM_TIMEZONE).format('YYYY-MM-DD');
  }
  return dayjs(date).tz(VIETNAM_TIMEZONE).format('YYYY-MM-DD');
}

/**
 * Compare two dates in Vietnam timezone
 * 
 * @param date1 - First date
 * @param date2 - Second date
 * @returns -1 if date1 < date2, 0 if equal, 1 if date1 > date2
 */
export function compareDates(date1: Date | string, date2: Date | string): number {
  const d1 = dayjs(date1).tz(VIETNAM_TIMEZONE);
  const d2 = dayjs(date2).tz(VIETNAM_TIMEZONE);
  
  if (d1.isBefore(d2)) return -1;
  if (d1.isAfter(d2)) return 1;
  return 0;
}

/**
 * Get start of day in Vietnam timezone
 * 
 * @param date - Date (defaults to current Vietnam time)
 * @returns Date object at 00:00:00 Vietnam time
 */
export function startOfDay(date?: Date | string): Date {
  if (!date) {
    return dayjs().tz(VIETNAM_TIMEZONE).startOf('day').utc(true).toDate();
  }
  return dayjs(date).tz(VIETNAM_TIMEZONE).startOf('day').utc(true).toDate();
}

/**
 * Get end of day in Vietnam timezone
 * 
 * @param date - Date (defaults to current Vietnam time)
 * @returns Date object at 23:59:59.999 Vietnam time
 */
export function endOfDay(date?: Date | string): Date {
  if (!date) {
    return dayjs().tz(VIETNAM_TIMEZONE).endOf('day').utc(true).toDate();
  }
  return dayjs(date).tz(VIETNAM_TIMEZONE).endOf('day').utc(true).toDate();
}
