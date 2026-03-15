/**
 * OpenAI function calling tool definitions for the sleep coach
 *
 * These tools allow the LLM to dynamically query user data
 * instead of receiving a static context block.
 */
export const SLEEP_COACH_TOOLS = [
    {
        type: "function",
        function: {
            name: "query_sleep_history",
            description: "Get the user's sleep logs for the past N days. Returns cycles completed, wake time, sleep onset, and disruptions for each night.",
            parameters: {
                type: "object",
                properties: {
                    days: { type: "number", description: "Number of days to look back (1-30)", minimum: 1, maximum: 30 },
                },
                required: ["days"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "get_calendar_events",
            description: "Get the user's upcoming calendar events within the next N hours. Shows event type, title, and timing.",
            parameters: {
                type: "object",
                properties: {
                    hours_ahead: { type: "number", description: "Number of hours ahead to look (1-168)", minimum: 1, maximum: 168 },
                },
                required: ["hours_ahead"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "get_life_events",
            description: "Get the user's life events (travel, illness, celebrations, etc). Includes upcoming and recent events.",
            parameters: {
                type: "object",
                properties: {
                    include_past: { type: "boolean", description: "Whether to include past events (last 14 days)" },
                },
                required: [],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "get_weekly_balance",
            description: "Get the current week's sleep cycle balance. Shows total cycles, deficit, on_track status, and day number.",
            parameters: {
                type: "object",
                properties: {},
                required: [],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "get_readiness_score",
            description: "Get the user's current readiness score based on the R90 engine. Shows T7 readiness, active states, and primary recommendation.",
            parameters: {
                type: "object",
                properties: {},
                required: [],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "get_lifestyle_profile",
            description: "Get the user's lifestyle profile including stress level, sleep environment quality, exercise frequency, and alcohol use.",
            parameters: {
                type: "object",
                properties: {},
                required: [],
            },
        },
    },
];
//# sourceMappingURL=tool-definitions.js.map