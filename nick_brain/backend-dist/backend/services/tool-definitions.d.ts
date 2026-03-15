/**
 * OpenAI function calling tool definitions for the sleep coach
 *
 * These tools allow the LLM to dynamically query user data
 * instead of receiving a static context block.
 */
export declare const SLEEP_COACH_TOOLS: ({
    type: "function";
    function: {
        name: string;
        description: string;
        parameters: {
            type: string;
            properties: {
                days: {
                    type: string;
                    description: string;
                    minimum: number;
                    maximum: number;
                };
                hours_ahead?: undefined;
                include_past?: undefined;
            };
            required: string[];
        };
    };
} | {
    type: "function";
    function: {
        name: string;
        description: string;
        parameters: {
            type: string;
            properties: {
                hours_ahead: {
                    type: string;
                    description: string;
                    minimum: number;
                    maximum: number;
                };
                days?: undefined;
                include_past?: undefined;
            };
            required: string[];
        };
    };
} | {
    type: "function";
    function: {
        name: string;
        description: string;
        parameters: {
            type: string;
            properties: {
                include_past: {
                    type: string;
                    description: string;
                };
                days?: undefined;
                hours_ahead?: undefined;
            };
            required: never[];
        };
    };
} | {
    type: "function";
    function: {
        name: string;
        description: string;
        parameters: {
            type: string;
            properties: {
                days?: undefined;
                hours_ahead?: undefined;
                include_past?: undefined;
            };
            required: never[];
        };
    };
})[];
