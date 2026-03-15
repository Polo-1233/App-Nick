/**
 * Pattern detector for weekly summaries
 *
 * Analyzes 4 weeks of summaries (oldest first) to detect sleep patterns.
 * Returns max 5 patterns sorted by priority.
 */
export function detectPatterns(summaries) {
    if (summaries.length === 0)
        return [];
    const patterns = [];
    // Sort chronologically (oldest first)
    const sorted = [...summaries].sort((a, b) => a.week_start.localeCompare(b.week_start));
    // 1. Improvement: avg_cycles increasing over 3 consecutive weeks
    if (sorted.length >= 3) {
        let improving = true;
        for (let i = 1; i < Math.min(sorted.length, 4); i++) {
            const prev = sorted[i - 1].avg_cycles;
            const curr = sorted[i].avg_cycles;
            if (prev === null || curr === null || curr <= prev) {
                improving = false;
                break;
            }
        }
        if (improving && sorted.length >= 3) {
            const first = sorted[0].avg_cycles ?? 0;
            const last = sorted[sorted.length - 1].avg_cycles ?? 0;
            const diff = Math.round((last - first) * 10) / 10;
            patterns.push({ priority: 1, text: `Sleep improving steadily (+${diff} avg cycles over ${sorted.length} weeks)` });
        }
    }
    // 2. Degradation: avg_cycles decreasing 2+ weeks
    if (sorted.length >= 2) {
        let declining = true;
        for (let i = sorted.length - 1; i >= Math.max(0, sorted.length - 2); i--) {
            if (i === 0)
                break;
            const prev = sorted[i - 1].avg_cycles;
            const curr = sorted[i].avg_cycles;
            if (prev === null || curr === null || curr >= prev) {
                declining = false;
                break;
            }
        }
        if (declining) {
            patterns.push({ priority: 2, text: "Sleep trending down — recovery focus needed" });
        }
    }
    // 3. Stress correlation
    for (const s of sorted) {
        if (s.stress_avg !== null && s.stress_avg > 3.5 && s.avg_cycles !== null && s.target_cycles !== null) {
            const target = s.target_cycles / 7; // nightly target
            if (s.avg_cycles < target) {
                patterns.push({ priority: 3, text: "High stress weeks correlate with poor sleep quality" });
                break;
            }
        }
    }
    // 4. Best week
    let bestWeek = null;
    for (const s of sorted) {
        if (s.avg_cycles !== null && (bestWeek === null || (bestWeek.avg_cycles ?? 0) < s.avg_cycles)) {
            bestWeek = s;
        }
    }
    if (bestWeek && bestWeek.avg_cycles !== null) {
        patterns.push({ priority: 4, text: `Best week: ${bestWeek.week_start} (${bestWeek.avg_cycles} avg cycles)` });
    }
    // 5. Accumulated deficit
    const totalDeficit = sorted.reduce((acc, s) => acc + (s.deficit ?? 0), 0);
    if (totalDeficit > 10) {
        patterns.push({ priority: 5, text: `Accumulated sleep debt: ${totalDeficit} cycles over ${sorted.length} weeks` });
    }
    // Sort by priority, return max 5
    return patterns
        .sort((a, b) => a.priority - b.priority)
        .slice(0, 5)
        .map(p => p.text);
}
//# sourceMappingURL=pattern-detector.js.map