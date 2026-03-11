/**
 * DayColumn — one vertical day grid column for the Calendar redesign.
 *
 * Parent scrolls this vertically inside a ScrollView.
 * Parent is responsible for the time-label column on the left.
 *
 * Visual hierarchy:
 *   R90 blocks (sleep / pre-sleep / CRP / down-period) → zIndex 2, full opacity
 *   External calendar events                           → zIndex 1, 82% opacity
 *   Conflicting calendar events                        → zIndex 3, red overlay
 *   R90 blocks targeted by a conflict                  → orange accent border
 *   Current-time red line                              → zIndex 10 (today only)
 */

import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { TimeBlock, Conflict, BlockType } from '@r90/types';
import {
  MIN_BLOCK_H,
  TOTAL_H,
  BLOCK_STYLE,
  CONFLICT_TINT,
  CONFLICT_BORDER,
  minToPx,
} from './constants';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  blocks: TimeBlock[];
  conflicts: Conflict[];
  colWidth: number;
  isToday?: boolean;
  /** Slight bg highlight for the "today" column in multi-day views. */
  isHighlighted?: boolean;
  /** Current minute-of-day; renders red "now" line when isToday=true. */
  currentMinute?: number;
  onBlockPress: (block: TimeBlock, conflict: Conflict | undefined) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const R90_TYPES = new Set<BlockType>([
  'sleep_cycle', 'pre_sleep', 'crp', 'down_period', 'wake',
]);

/** Match a calendar_event block to its conflict by comparing start time. */
function findConflict(block: TimeBlock, conflicts: Conflict[]): Conflict | undefined {
  if (block.type !== 'calendar_event') return undefined;
  return conflicts.find(c => c.event.start === block.start);
}

/** Set of R90 BlockTypes that are the target of at least one conflict. */
function conflictedR90Types(conflicts: Conflict[]): Set<BlockType> {
  const s = new Set<BlockType>();
  conflicts.forEach(c => s.add(c.overlapsWith));
  return s;
}

function fmtMin(m: number): string {
  const norm = ((m % 1440) + 1440) % 1440;
  const h = Math.floor(norm / 60);
  const min = norm % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DayColumn({
  blocks,
  conflicts,
  colWidth,
  isToday,
  isHighlighted,
  currentMinute,
  onBlockPress,
}: Props) {
  const targetedTypes = conflictedR90Types(conflicts);
  const displayBlocks = blocks.filter(b => b.type !== 'free');

  return (
    <View
      style={[
        styles.col,
        { width: colWidth, height: TOTAL_H },
        isHighlighted && styles.todayBg,
      ]}
    >
      {/* ─── Grid lines (every 30 min) ─── */}
      {Array.from({ length: 48 }, (_, i) => (
        <View
          key={i}
          style={[
            styles.gridLine,
            { top: minToPx(i * 30), opacity: i % 2 === 0 ? 0.18 : 0.06 },
          ]}
        />
      ))}

      {/* ─── Blocks ─── */}
      {displayBlocks.map((block, idx) => {
        const conflict     = findConflict(block, conflicts);
        const isExternal   = block.type === 'calendar_event';
        const isR90        = R90_TYPES.has(block.type);
        const isTarget     = isR90 && targetedTypes.has(block.type);
        const style        = BLOCK_STYLE[block.type];

        // Wrap-handling: if end < start the block crosses midnight.
        // Render only the pre-midnight portion in this day's grid.
        const effectiveEnd = block.end > block.start ? block.end : 1440;
        const top          = minToPx(block.start);
        const rawH         = minToPx(effectiveEnd - block.start);
        const height       = Math.max(rawH, MIN_BLOCK_H);

        const borderColor  = conflict
          ? CONFLICT_BORDER
          : isTarget
          ? '#F97316'
          : style.border;

        return (
          <Pressable
            key={idx}
            style={[
              styles.block,
              {
                top,
                height,
                width: colWidth - 6,
                backgroundColor: style.bg,
                borderColor,
                zIndex: conflict ? 3 : isExternal ? 1 : 2,
                opacity: isExternal ? 0.85 : 1,
              },
              (conflict || isTarget) && styles.blockAccented,
            ]}
            onPress={() => onBlockPress(block, conflict)}
          >
            {/* Red tint overlay for conflicting calendar events */}
            {conflict && (
              <View style={[StyleSheet.absoluteFill, styles.conflictOverlay]} />
            )}

            <Text
              style={[styles.blockLabel, { color: style.text }]}
              numberOfLines={1}
            >
              {block.label}
            </Text>

            {height > 30 && (
              <Text
                style={[styles.blockTime, { color: style.text }]}
                numberOfLines={1}
              >
                {fmtMin(block.start)}
              </Text>
            )}
          </Pressable>
        );
      })}

      {/* ─── Current-time indicator ─── */}
      {isToday && currentMinute !== undefined && (
        <View
          style={[styles.nowRow, { top: minToPx(currentMinute) }]}
          pointerEvents="none"
        >
          <View style={styles.nowDot} />
          <View style={styles.nowBar} />
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  col: {
    position: 'relative',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: '#1F1F1F',
  },
  todayBg: {
    backgroundColor: 'rgba(255,255,255,0.025)',
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#FFFFFF',
  },
  block: {
    position: 'absolute',
    left: 3,
    borderRadius: 5,
    borderLeftWidth: 3,
    paddingHorizontal: 5,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  blockAccented: {
    borderWidth: 1.5,
    borderLeftWidth: 1.5,
  },
  conflictOverlay: {
    backgroundColor: CONFLICT_TINT,
    borderRadius: 4,
  },
  blockLabel: {
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 13,
  },
  blockTime: {
    fontSize: 9,
    opacity: 0.65,
    marginTop: 1,
  },
  nowRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  nowDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    marginLeft: -4,
  },
  nowBar: {
    flex: 1,
    height: 1.5,
    backgroundColor: '#EF4444',
    opacity: 0.9,
  },
});
