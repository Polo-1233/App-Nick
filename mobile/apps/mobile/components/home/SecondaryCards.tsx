/**
 * SecondaryCards — Compact info cards below the main action area.
 *
 * Render NOTHING if no data.
 * Types: calendar, insight, weekly.
 *
 * Uses theme colors for dark/light mode consistency.
 */

import { memo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../lib/theme-context';
import { spacing, radius, opacity as op } from '../../lib/design-tokens';

export interface CalendarCard  { type: 'calendar';  title: string; subtitle: string; onDismiss: () => void }
export interface InsightCard   { type: 'insight';   id: string; message: string; onDismiss: () => void }
export interface WeeklyCard    { type: 'weekly';    streakDays: number }
export type SecondaryCardData  = CalendarCard | InsightCard | WeeklyCard;

// ─── Insight card with expand/collapse ───────────────────────────────────────
function InsightCardItem({ card }: { card: InsightCard }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [expanded, setExpanded] = useState(false);

  return (
    <Pressable onPress={() => setExpanded(e => !e)} style={[sc.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={[sc.iconWrap, { backgroundColor: `${c.warning}${op.medium}` }]}>
        <Ionicons name="bulb-outline" size={16} color={c.warning} />
      </View>
      <View style={sc.body}>
        <Text style={[sc.label, { color: c.warning }]}>DID YOU KNOW?</Text>
        <Text style={[sc.title, { color: c.text }]} numberOfLines={expanded ? undefined : 2}>
          {card.message}
        </Text>
        {!expanded && (
          <Text style={[sc.readMore, { color: c.accent }]}>Read more</Text>
        )}
      </View>
      {expanded ? (
        <Pressable onPress={card.onDismiss} hitSlop={10}>
          <Ionicons name="checkmark-circle" size={20} color={c.accent} />
        </Pressable>
      ) : (
        <Ionicons name="chevron-down" size={16} color={c.accent} />
      )}
    </Pressable>
  );
}

interface SecondaryCardsProps { cards: SecondaryCardData[] }

export const SecondaryCards = memo(function SecondaryCards({ cards }: SecondaryCardsProps) {
  const { theme } = useTheme();
  const c = theme.colors;

  if (!cards.length) return null;

  // Limit to 2 visible cards to reduce cognitive load
  const visibleCards = cards.slice(0, 2);

  return (
    <View style={sc.wrap}>
      {visibleCards.map((card, i) => {
        if (card.type === 'calendar') return (
          <Pressable key={i} onPress={card.onDismiss} style={[sc.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <View style={[sc.iconWrap, { backgroundColor: `${c.accent}${op.medium}` }]}>
              <Ionicons name="calendar-outline" size={16} color={c.accent} />
            </View>
            <View style={sc.body}>
              <Text style={[sc.title, { color: c.text }]} numberOfLines={1}>{card.title}</Text>
              <Text style={[sc.sub, { color: c.textMuted }]} numberOfLines={1}>{card.subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color={c.textMuted} />
          </Pressable>
        );

        if (card.type === 'insight') return (
          <InsightCardItem key={i} card={card} />
        );

        if (card.type === 'weekly') return (
          <View key={i} style={[sc.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <View style={[sc.iconWrap, { backgroundColor: `${c.accent}${op.medium}` }]}>
              <Ionicons name="stats-chart-outline" size={16} color={c.accent} />
            </View>
            <View style={sc.body}>
              <Text style={[sc.title, { color: c.text }]}>Weekly report</Text>
              <Text style={[sc.sub, { color: c.textMuted }]}>
                {card.streakDays > 0 ? `${card.streakDays} days rhythm flow` : 'Check your Insights'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color={c.textMuted} />
          </View>
        );

        return null;
      })}
    </View>
  );
});

const sc = StyleSheet.create({
  wrap: {
    gap:       spacing.sm,
    marginTop: spacing.lg,
  },
  card: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.md,
    marginHorizontal:  spacing.screen,
    paddingVertical:   14,
    paddingHorizontal: spacing.lg,
    borderRadius:      radius.lg,
    borderWidth:       1,
  },
  iconWrap: {
    width:           36,
    height:          36,
    borderRadius:    10,
    alignItems:      'center',
    justifyContent:  'center',
  },
  body:     { flex: 1 },
  label:    { fontSize: 10, fontWeight: '800', letterSpacing: 1.0, marginBottom: 3 },
  title:    { fontSize: 13, fontWeight: '700', lineHeight: 18 },
  sub:      { fontSize: 12, marginTop: 2 },
  dismiss:  { fontSize: 14, fontWeight: '700' },
  readMore: { fontSize: 11, fontWeight: '600', marginTop: 4 },
});
