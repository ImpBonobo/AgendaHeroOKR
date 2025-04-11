import moment from "moment";

/**
 * Format a date for display
 * @param date Date to format
 * @param format Format string (default: YYYY-MM-DD)
 * @returns Formatted date string
 */
export function formatDate(date: Date, format: string = 'YYYY-MM-DD'): string {
    return moment(date).format(format); // moment is a function that returns an object with format method
}

/**
 * Parse a date string
 * @param dateString Date string to parse
 * @param format Format of the date string
 * @returns Parsed Date object
 */
export function parseDate(dateString: string, format?: string): Date {
    return format 
        ? moment(dateString, format).toDate() 
        : moment(dateString).toDate();
}

/**
 * Calculate the difference between two dates in days
 * @param date1 First date
 * @param date2 Second date
 * @returns Difference in days
 */
export function daysBetween(date1: Date, date2: Date): number {
    const diff = Math.abs(date1.getTime() - date2.getTime());
    return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/**
 * Check if a date is in the past
 * @param date Date to check
 * @returns True if the date is in the past
 */
export function isPast(date: Date): boolean {
    return date.getTime() < Date.now();
}

/**
 * Check if a date is today
 * @param date Date to check
 * @returns True if the date is today
 */
export function isToday(date: Date): boolean {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
}

/**
 * Add days to a date
 * @param date Base date
 * @param days Number of days to add
 * @returns New date
 */
export function addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}


