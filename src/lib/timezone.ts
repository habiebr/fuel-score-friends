/**
 * Timezone utilities for handling user-specific date/time operations
 */

// Indonesian timezone (WIB = UTC+7)
const INDONESIA_TIMEZONE = 'Asia/Jakarta';

/**
 * Get the current date/time in Indonesian timezone
 */
export function getIndonesianTime(date: Date = new Date()): Date {
  // Convert to Indonesian timezone
  const indonesianTime = new Date(date.toLocaleString('en-US', { timeZone: INDONESIA_TIMEZONE }));
  return indonesianTime;
}

/**
 * Get the start of the current week (Monday 00:00) in Indonesian timezone
 * Returns ISO string in UTC that represents Monday 00:00 WIB
 */
export function getWeekStartIndonesian(referenceDate?: Date): Date {
  const now = referenceDate || new Date();
  
  // Get current time in Indonesian timezone
  const indonesianTime = getIndonesianTime(now);
  
  // Get day of week (0 = Sunday, 1 = Monday, etc.)
  const dayOfWeek = indonesianTime.getDay();
  
  // Calculate days to subtract to get to Monday
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  
  // Create Monday 00:00:00 in Indonesian timezone
  const monday = new Date(indonesianTime);
  monday.setDate(monday.getDate() - daysToMonday);
  monday.setHours(0, 0, 0, 0);
  
  return monday;
}

/**
 * Get the start and end of a date in the user's local timezone
 * This returns UTC timestamps that represent the local day boundaries
 */
export function getLocalDayBoundaries(date: Date): { start: string; end: string } {
  // Create start of day in local timezone
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  // Create end of day in local timezone
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  return {
    start: startOfDay.toISOString(),
    end: endOfDay.toISOString()
  };
}

/**
 * Get the local date string in YYYY-MM-DD format
 */
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Convert a UTC timestamp to local date string
 */
export function utcToLocalDateString(utcTimestamp: string): string {
  const date = new Date(utcTimestamp);
  return getLocalDateString(date);
}

/**
 * Get start and end ISO strings for a specific date string (YYYY-MM-DD)
 * accounting for the user's local timezone
 */
export function getDateRangeForQuery(dateString: string): { start: string; end: string } {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return getLocalDayBoundaries(date);
}
