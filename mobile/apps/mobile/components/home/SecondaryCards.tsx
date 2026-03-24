/**
 * SecondaryCards
 *
 * Compact info cards below the main action cards.
 * Render NOTHING if no data.
 *
 * Matches reference style: slightly lighter blue cards, smaller, compact.
 * Types: calendar, insight, weekly.
 */

import { memo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const ACCENT     = '#1c9fda';
const GOLD       = '#D97706';
const CARD_BG    = '#DCF0FB';   // bleu R90 pâle mais visible en light mode
const CARD_BORDER= 'rgba(28,159,218,0.25)';
const TEXT_MAIN  = '#002060';
const TEXT_MUTED = '#3A5A7A';

export interface CalendarCard  { type: 'calendar';  title: string; subtitle: string; onDismiss: () => void }
export interface InsightCard   { type: 'insight';   id: string; message: string; onDismiss: () => void }
export interface WeeklyCard    { type: 'weekly';    streakDays: number }
export type SecondaryCardData  = CalendarCard | InsightCard | WeeklyCard;

// ─── Insight card with expand/collapse ───────────────────────────────────────
function InsightCardItem({ card }: { card: InsightCard }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Pressable onPress={() => setExpanded(e => !e)} style={sc.card}>
      <View style={sc.iconWrap}>
        <Ionicons name="bulb-outline" size={16} color={GOLD} />
      </View>
      <View style={sc.body}>
        <Text style={sc.label}>DID YOU KNOW?</Text>
        <Text style={sc.title} numberOfLines={expanded ? undefined : 2}>
          {card.message}
        </Text>
        {!expanded && (
          <Text style={sc.readMore}>Read more</Text>
        )}
      </View>
      {expanded ? (
        <Pressable onPress={card.onDismiss} hitSlop={10}>
          <Ionicons name="checkmark-circle" size={20} color={ACCENT} />
        </Pressable>
      ) : (
        <Ionicons name="chevron-down" size={16} color={ACCENT} />
      )}
    </Pressable>
  );
}

interface SecondaryCardsProps { cards: SecondaryCardData[] }

export const SecondaryCards = memo(function SecondaryCards({ cards }: SecondaryCardsProps) {
  if (!cards.length) return null;

  return (
    <View style={sc.wrap}>
      {cards.map((card, i) => {
        if (card.type === 'calendar') return (
          <Pressable key={i} onPress={card.onDismiss} style={sc.card}>
            <View style={sc.iconWrap}>
              <Ionicons name="calendar-outline" size={16} color={ACCENT} />
            </View>
            <View style={sc.body}>
              <Text style={sc.title} numberOfLines={1}>{card.title}</Text>
              <Text style={sc.sub}   numberOfLines={1}>{card.subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color={TEXT_MUTED} />
          </Pressable>
        );

        if (card.type === 'insight') return (
          <InsightCardItem key={i} card={card} />
        );

        if (card.type === 'weekly') return (
          <View key={i} style={sc.card}>
            <View style={sc.iconWrap}>
              <Ionicons name="stats-chart-outline" size={16} color={ACCENT} />
            </View>
            <View style={sc.body}>
              <Text style={sc.title}>Weekly report</Text>
              <Text style={sc.sub}>
                {card.streakDays > 0 ? `${card.streakDays} days rhythm flow` : 'Check your Insights'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color={TEXT_MUTED} />
          </View>
        );

        return null;
      })}
    </View>
  );
});

const sc = StyleSheet.create({
  wrap: {
    gap:       8,
    marginTop: 16,
  },
  card: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               12,
    marginHorizontal:  20,
    paddingVertical:   14,
    paddingHorizontal: 16,
    borderRadius:      16,
    backgroundColor:   CARD_BG,
    borderWidth:       1,
    borderColor:       CARD_BORDER,
    shadowColor:       '#1c9fda',
    shadowOffset:      { width: 0, height: 3 },
    shadowOpacity:     0.12,
    shadowRadius:      10,
    elevation:         3,
  },
  iconWrap: {
    width:           36,
    height:          36,
    borderRadius:    10,
    backgroundColor: `${ACCENT}28`,
    alignItems:      'center',
    justifyContent:  'center',
  },
  body:    { flex: 1 },
  label:   { fontSize: 10, fontWeight: '800', color: GOLD,       letterSpacing: 1.0, marginBottom: 3 },
  title:   { fontSize: 13, fontWeight: '700', color: TEXT_MAIN,  lineHeight: 18 },
  sub:     { fontSize: 12, color: TEXT_MUTED, marginTop: 2 },
  dismiss:  { fontSize: 14, color: ACCENT, fontWeight: '700' },
  readMore: { fontSize: 11, color: ACCENT, fontWeight: '600', marginTop: 4 },
});
