/**
 * Calendar event classifier
 *
 * Classifies calendar events by title keywords into event_type_hint categories.
 */
const KEYWORDS = {
    travel: ["flight", "vol", "airport", "aéroport", "train", "hotel", "trip", "voyage", "départ", "arrival"],
    meeting: ["call", "meeting", "réunion", "standup", "sync", "interview", "review", "demo"],
    important: ["exam", "launch", "deadline", "conference", "keynote", "pitch", "présentation"],
    social: ["dinner", "dîner", "birthday", "wedding", "party", "fête", "celebration"],
    health: ["doctor", "médecin", "dentist", "gym", "sport", "yoga", "run", "workout"],
};
/**
 * Classify a calendar event title into a category.
 * Returns the first matching category or "other".
 */
export function classifyCalendarEvent(title) {
    const lower = title.toLowerCase();
    for (const [category, words] of Object.entries(KEYWORDS)) {
        for (const word of words) {
            if (lower.includes(word))
                return category;
        }
    }
    return "other";
}
//# sourceMappingURL=calendar-classifier.js.map