/**
 * R90 Backend — Coaching Copy
 *
 * Static message templates keyed by recommendation type.
 * In production this would be served from a CMS or localised strings file.
 * The engine outputs message_key values; this map resolves them to displayable text.
 *
 * Tone rules (from R90_RULE_ENGINE_SPEC.md):
 * - Never use fear-based statistics
 * - Never use outcome comparisons when US-07 is active
 * - Frame CRP as recovery tool, not "nap"
 * - Cycles, not hours
 */
export const COACHING_COPY = {
    "REC-01": {
        title: "Set your anchor",
        body: "Before we can build your recovery plan, we need one fixed number: your wake time. Everything — when to sleep, when to rest — follows from it.",
        cta: "Set my wake time",
    },
    "REC-02": {
        title: "Tonight's sleep window",
        body: "Aim to be asleep by {sleep_onset_5cycle} for 5 complete cycles. Miss it? Wait for {fallback_onset} — don't force sleep mid-cycle.",
        cta: "See day plan",
    },
    "REC-03": {
        title: "Schedule a recovery rest",
        body: "A 30-minute rest between {crp_window_open} and {crp_window_close} today adds a full cycle to your week.",
        cta: "Add to schedule",
    },
    "REC-03_process_routine": {
        title: "Your recovery rest",
        body: "A 30-minute rest this afternoon is part of your recovery process today. Protect the time between {crp_window_open} and {crp_window_close}.",
        cta: "Add to schedule",
    },
    "REC-03_pre_event_prep": {
        title: "Pre-event recovery rest",
        body: "A CRP this afternoon will sharpen you for tomorrow — independent of last week's total. Protect {crp_window_open}–{crp_window_close}.",
        cta: "Add to schedule",
    },
    "REC-04": {
        title: "Your Micro Reset Moments",
        body: "Every 90 minutes, take a 3–5 minute Micro Reset Moment: no screens, no inputs, vacant mindspace. It's not optional — it's the floor.",
        cta: "Learn more",
    },
    "REC-05": {
        title: "Reset moment",
        body: "3–5 minutes. Nothing required.",
        cta: "Done",
    },
    "REC-06": {
        title: "Post-sleep routine",
        body: "Now: bladder → light → hydrate → food → challenge → exercise → bowels. In that order. Start the day right.",
        cta: "Got it",
    },
    "REC-07": {
        title: "Morning light",
        body: "Step outside for 10 minutes. Even overcast light resets your circadian clock and prepares your melatonin window for tonight.",
        cta: "Done",
    },
    "REC-08": {
        title: "Phase 3 starting",
        body: "Phase 3 has started. Shift lights to warm. No new demanding work. Your biology is already beginning its preparation for sleep.",
        cta: "Got it",
    },
    "REC-09": {
        title: "Evening light",
        body: "Blue and white light — even dim — suppresses melatonin. Switch to amber, yellow, or red spectrum as you move through your evening.",
        cta: "Got it",
    },
    "REC-10": {
        title: "Bedroom temperature",
        body: "Your bedroom needs to be cooler than your body. The temperature gap is a biological trigger for sleep onset. A hot room blocks it.",
        cta: "Fix it",
    },
    "REC-11": {
        title: "Environment audit",
        body: "Imagine your bedroom completely empty — only bring back what serves your recovery. Start with: temperature, light, function.",
        cta: "Start audit",
    },
    "REC-12": {
        title: "Shift your wake time",
        body: "Your natural peak is in the afternoon. If there's flexibility in your schedule, consider shifting your wake time by 30–60 minutes later.",
        cta: "Adjust ARP",
    },
    "REC-13": {
        title: "Cycles, not hours",
        body: "4.5 hours of 3 complete cycles is better recovery than 5 hours with an interrupted 4th. One short night doesn't break your week — it's an input your system manages.",
    },
    "REC-14": {
        title: "Weekly balance",
        body: "This week: {weekly_total} cycles of 35 target.",
        cta: "See full summary",
    },
    "REC-15": {
        title: "The 15-minute rule",
        body: "If sleep doesn't come within 15 minutes: get up. Amber light only. No screens. No tasks. Wait for the next 90-minute boundary. Try again then.",
        cta: "Got it",
    },
    "REC-16": {
        title: "2–3am waking: this is normal",
        body: "Waking at 2–3am is a polyphasic transition point from our pre-electric-light biology. Don't calculate remaining sleep. Don't panic. Quiet, dim, no screens. Wait for the next cycle boundary.",
        cta: "Got it",
    },
    "REC-17": {
        title: "Caffeine timing",
        body: "Nothing caffeinated after 14:00. This isn't about cutting caffeine — it's about stopping it from competing with your melatonin window tonight.",
        cta: "Got it",
    },
    "REC-18": {
        title: "Your tracker is a guide, not a verdict",
        body: "Check weekly averages, not nightly scores. How you feel and how your process looks are better indicators than any algorithm.",
        cta: "Got it",
    },
    "REC-19": {
        title: "Tightening your sleep window",
        body: "We're consolidating your sleep by tightening your window. Same wake time. Slightly later bedtime. Your sleep drive gets stronger.",
        cta: "Start protocol",
    },
    "REC-20": {
        title: "Let's build your recovery plan",
        body: "To use the R90 system, you need one fixed number: your wake time. Everything else follows from it.",
        cta: "Start setup",
    },
    "REC-21": {
        title: "Social Jet Lag",
        body: "Your internal clock and your schedule are out of sync — this is Social Jet Lag. 70% of people live this way. We can't change your biology, but we can work with it. Protect your afternoon window for what matters most.",
        cta: "Got it",
    },
    "REC-22": {
        title: "Recovery after disruption",
        body: "Your system handled a disruption. ARP held — that's the key. Schedule a recovery rest today to rebalance. Typical recovery: 2–3 days.",
        cta: "Schedule rest",
    },
    "REC-23": {
        title: "Before your event",
        body: "You may sleep less tonight — that's expected. Don't try to force it. Even 3 complete cycles is enough to perform well tomorrow. Follow the process.",
        cta: "Got it",
    },
    "REC-24": {
        title: "Recovery mode",
        body: "Recovery mode: maximise rest. Recovery rests can happen at any time today. Your cycle target is 6 tonight if you can get it. The framework absorbs this.",
        cta: "Got it",
    },
    "REC-25": {
        title: "Recovery day",
        body: "Today is a recovery day. Protect the afternoon window for a full rest. Reduce demands on yourself this afternoon. The week is recoverable.",
        cta: "Schedule rest",
    },
    "REC-26": {
        title: "Travel setup",
        body: "Travelling tonight. Keep your wake time in the destination timezone from tonight. Blackout and cool — your two priorities for the hotel room.",
        cta: "Got it",
    },
};
/**
 * Get coaching message for a recommendation type, with optional variable interpolation.
 */
export function getCoachingMessage(recType, variables = {}, tone) {
    const key = tone ? `${recType}_${tone}` : recType;
    const template = COACHING_COPY[key] ?? COACHING_COPY[recType] ?? {
        title: recType,
        body: "Follow the process.",
    };
    // Simple variable interpolation: replace {key} with value
    const interpolate = (text) => text.replace(/\{(\w+)\}/g, (_, k) => variables[k] ?? `[${k}]`);
    return {
        title: interpolate(template.title),
        body: interpolate(template.body),
        cta: template.cta ? interpolate(template.cta) : undefined,
    };
}
//# sourceMappingURL=coaching-copy.js.map