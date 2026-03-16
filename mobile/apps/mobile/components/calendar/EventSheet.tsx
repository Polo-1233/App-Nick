/**
 * EventSheet — slide-up bottom sheet shown when a block or event is tapped.
 *
 * Content adapts based on what was tapped:
 *   • R90 block (sleep, pre-sleep…) → type badge, label, time range
 *   • Calendar event, no conflict    → event title, time range
 *   • Calendar event with conflict   → same + ConflictCard with resolution options
 *
 * Animation: backdrop fade + spring card slide-up (Animated API, native driver).
 */

import { useRef, useEffect, useState } from 'react';
import {
  Animated,
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import type { TimeBlock, Conflict, ConflictOption } from '@r90/types';
import { BLOCK_STYLE, BLOCK_LABEL } from './constants';
import { ConflictCard } from '../ConflictCard';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  block: TimeBlock | null;
  conflict: Conflict | null;
  conflictOptions: ConflictOption[];
  selectedOptionIndex: number | null;
  onSelectOption: (index: number, option: ConflictOption) => void;
  onClose: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMin(m: number): string {
  const norm = ((m % 1440) + 1440) % 1440;
  const h    = Math.floor(norm / 60);
  const min  = norm % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function durationLabel(start: number, end: number): string {
  const mins = end >= start ? end - start : 1440 - start + end;
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function EventSheet({
  visible,
  block,
  conflict,
  conflictOptions,
  selectedOptionIndex,
  onSelectOption,
  onClose,
}: Props) {
  const backdropOp  = useRef(new Animated.Value(0)).current;
  const cardY       = useRef(new Animated.Value(400)).current;
  const mounted     = useRef(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => { return () => { mounted.current = false; }; }, []);

  useEffect(() => {
    if (visible) {
      backdropOp.setValue(0);
      cardY.setValue(400);
      Animated.parallel([
        Animated.timing(backdropOp, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(cardY, {
          toValue: 0,
          damping: 22,
          stiffness: 260,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      if (mounted.current) setLoading(false);
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!block) return null;

  const style    = BLOCK_STYLE[block.type];
  const typeLabel = BLOCK_LABEL[block.type];
  const endMin   = block.end > block.start ? block.end : block.end + 1440;

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="none"
      onRequestClose={onClose}
    >
      {/* ── Backdrop ── */}
      <Animated.View style={[s.backdrop, { opacity: backdropOp }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* ── Card ── */}
      <Animated.View style={[s.sheet, { transform: [{ translateY: cardY }] }]}>
        {/* Drag handle */}
        <View style={s.handle} />

        {/* Header row */}
        <View style={s.sheetHeader}>
          <View
            style={[
              s.typeBadge,
              { backgroundColor: style.border + '22', borderColor: style.border },
            ]}
          >
            <Text style={[s.typeText, { color: style.text }]}>{typeLabel}</Text>
          </View>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={s.closeX}>✕</Text>
          </Pressable>
        </View>

        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Block title */}
          <Text style={s.blockTitle}>{block.label}</Text>

          {/* Time range + duration */}
          <Text style={s.timeRange}>
            {fmtMin(block.start)} → {fmtMin(endMin)}
            {'  ·  '}
            {durationLabel(block.start, block.end)}
          </Text>

          {/* Calendar source badge — shown when event has source metadata */}
          {conflict?.event.sourceName && (
            <View style={s.sourceBadge}>
              {conflict.event.color ? (
                <View style={[s.sourceDot, { backgroundColor: conflict.event.color }]} />
              ) : null}
              <Text style={s.sourceText}>
                {conflict.event.calendarName
                  ? `${conflict.event.calendarName} · ${conflict.event.sourceName}`
                  : conflict.event.sourceName}
              </Text>
            </View>
          )}

          {/* Conflict section */}
          {conflict && (
            <View style={s.conflictWrap}>
              <Text style={s.conflictSectionLabel}>⚠ Schedule conflict</Text>
              <ConflictCard
                conflict={conflict}
                options={conflictOptions}
                selectedOptionIndex={selectedOptionIndex}
                onSelectOption={onSelectOption}
              />
            </View>
          )}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.60)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#131313',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: '72%',
    paddingHorizontal: 20,
    paddingBottom: 36,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 24,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#3A3A3A',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  typeBadge: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  typeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  closeX: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '500',
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingBottom: 8,
  },
  blockTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 6,
  },
  timeRange: {
    color: '#9CA3AF',
    fontSize: 14,
    marginBottom: 20,
  },
  // Source badge
  sourceBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               6,
    marginTop:         8,
    marginBottom:      4,
    paddingVertical:   5,
    paddingHorizontal: 10,
    borderRadius:      20,
    backgroundColor:   'rgba(255,255,255,0.07)',
    alignSelf:         'flex-start',
  },
  sourceDot: {
    width:        8,
    height:       8,
    borderRadius: 4,
  },
  sourceText: {
    color:      'rgba(255,255,255,0.55)',
    fontSize:   12,
    fontWeight: '500',
  },
  conflictWrap: {
    marginTop: 4,
  },
  conflictSectionLabel: {
    color: '#F97316',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 10,
  },
});
