/**
 * Calendar event classifier
 *
 * Classifies calendar events by title keywords into event_type_hint categories.
 */
/**
 * Classify a calendar event title into a category.
 * Returns the first matching category or "other".
 */
export declare function classifyCalendarEvent(title: string): string;
