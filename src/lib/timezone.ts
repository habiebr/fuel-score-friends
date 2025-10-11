import { format, startOfDay, endOfDay, subDays, addDays } from 'date-fns';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';

/**
 * Get the user's timezone from browser or default to UTC
 */
export function getUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
}

/**
 * Get today's date in user's timezone as YYYY-MM-DD string
 */
export function getTodayInUserTimezone(): string {
  const userTimezone = getUserTimezone();
  const now = new Date();
  const zonedDate = toZonedTime(now, userTimezone);
  return format(zonedDate, 'yyyy-MM-dd');
}

/**
 * Get start of day in user's timezone as UTC ISO string
 * This ensures we capture all logs from the user's "today" regardless of timezone
 */
export function getStartOfDayInUserTimezone(date?: Date): string {
  const userTimezone = getUserTimezone();
  const targetDate = date || new Date();
  const zonedDate = toZonedTime(targetDate, userTimezone);
  const startOfDayLocal = startOfDay(zonedDate);
  const startOfDayUTC = fromZonedTime(startOfDayLocal, userTimezone);
  return startOfDayUTC.toISOString();
}

/**
 * Get end of day in user's timezone as UTC ISO string
 * This ensures we capture all logs from the user's "today" regardless of timezone
 */
export function getEndOfDayInUserTimezone(date?: Date): string {
  const userTimezone = getUserTimezone();
  const targetDate = date || new Date();
  const zonedDate = toZonedTime(targetDate, userTimezone);
  const endOfDayLocal = endOfDay(zonedDate);
  const endOfDayUTC = fromZonedTime(endOfDayLocal, userTimezone);
  return endOfDayUTC.toISOString();
}

/**
 * Get date range for a specific date in user's timezone
 * Returns { start: UTC ISO string, end: UTC ISO string, dateString: YYYY-MM-DD }
 */
export function getDateRangeInUserTimezone(date?: Date) {
  const userTimezone = getUserTimezone();
  const targetDate = date || new Date();
  const zonedDate = toZonedTime(targetDate, userTimezone);
  const dateString = format(zonedDate, 'yyyy-MM-dd');
  
  const startOfDayLocal = startOfDay(zonedDate);
  const endOfDayLocal = endOfDay(zonedDate);
  
  const startUTC = fromZonedTime(startOfDayLocal, userTimezone);
  const endUTC = fromZonedTime(endOfDayLocal, userTimezone);
  
  return {
    start: startUTC.toISOString(),
    end: endUTC.toISOString(),
    dateString
  };
}

/**
 * Get date range for a specific date string (YYYY-MM-DD) in user's timezone
 */
export function getDateRangeFromString(dateString: string) {
  const userTimezone = getUserTimezone();
  const date = new Date(dateString + 'T00:00:00');
  return getDateRangeInUserTimezone(date);
}

/**
 * Convert a UTC timestamp to user's timezone date string
 */
export function utcToUserTimezoneDateString(utcTimestamp: string): string {
  const userTimezone = getUserTimezone();
  const utcDate = new Date(utcTimestamp);
  const zonedDate = toZonedTime(utcDate, userTimezone);
  return format(zonedDate, 'yyyy-MM-dd');
}

/**
 * Get the last N days in user's timezone
 */
export function getLastNDaysInUserTimezone(days: number): Array<{ dateString: string; start: string; end: string }> {
  const userTimezone = getUserTimezone();
  const today = new Date();
  const result = [];
  
  for (let i = days - 1; i >= 0; i--) {
    const date = subDays(today, i);
    const range = getDateRangeInUserTimezone(date);
    result.push(range);
  }
  
  return result;
}

/**
 * Check if a UTC timestamp falls within a user's "today"
 */
export function isTimestampTodayInUserTimezone(timestamp: string): boolean {
  const userTimezone = getUserTimezone();
  const todayRange = getDateRangeInUserTimezone();
  const timestampDate = new Date(timestamp);
  
  return timestampDate >= new Date(todayRange.start) && timestampDate <= new Date(todayRange.end);
}
