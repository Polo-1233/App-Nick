/**
 * SecondaryCards
 *
 * Optional contextual cards. Renders NOTHING if no data.
 *
 * Rules:
 *   - Only show if there is genuinely useful information
 *   - Never clutter the screen with empty states
 *   - Small cards: 60px height, subtle background
 *
 * Supported card types:
 *   - calendar: upcoming event conflict or note
 *   - insight:  daily coach micro-tip (max 1/day)
 *   - weekly:   weekly summary (Sunday evening / Monday morning only)
 */

import { memo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const ACCENT = '#1c9fda';
const TEXT   = '#002060';
const MUTED  = '#6B7A90';
const BG     = '#F7FAFD';

// ─── Card data types ────────────────────────────────────────────────────────────
export interface CalendarCard {
  type:      'calendar';
  title:     string;
  subtitle:  string;
  onDismiss: () => void;
}

export interface InsightCard {
  type:      'insight';
  id:        string;
  message:   string;
  onDismiss: () => void;
}

export interface WeeklyCard {
  type:     'weekly';
  streakDays: number;
}

export type SecondaryCardData = CalendarCard | InsightCard | WeeklyCard;

interface SecondaryCardsProps {
  cards: SecondaryCardData[];
}

// ─── Component ─────────────────────────────────────────────────────────────────
export const SecondaryCards = memo(function SecondaryCards({ cards }: SecondaryCardsProps) {
  // Nothing to show → render nothing (no empty state, no placeholder)
  if (!cards.length) return null;

  return (
    <View style={sc.wrap}>
      {cards.map((card, i) => {
        if (card.type === 'calendar') {
          return (
            <Pressable key={i} onPress={card.onDismiss} style={sc.card}>
              <Ionicons name="calendar-outline" size={16} color={ACCENT} />
              <View style={sc.body}>
                <Text style={sc.cardTitle} numberOfLines={1}>{card.title}</Text>
                <Text style={sc.cardSub}   numberOfLines={1}>{card.subtitle}</Text>
              </View>
            </Pressable>
          );
        }

        if (card.type === 'insight') {
          return (
            <View key={i} style={sc.card}>
              <Text style={sc.emoji}>💡</Text>
              <Text style={[sc.cardTitle, { flex: 1 }]} numberOfLines={2}>{card.message}</Text>
              <Pressable onPress={card.onDismiss} hitSlop={10}>
                <Text style={sc.dismiss}>✓</Text>
              </Pressable>
            </View>
          );
        }

        if (card.type === 'weekly') {
          return (
            <View key={i} style={sc.card}>
              <Text style={sc.emoji}>📊</Text>
              <View style={sc.body}>
                <Text style={sc.cardTitle}>Weekly report</Text>
                <Text style={sc.cardSub}>
                  {card.streakDays > 0 ? `${card.streakDays} days rhythm flow` : 'Check your Insights'}
                </Text>
              </View>
            </View>
          );
        }

        return null;
      })}
    </View>
  );
});

// ─── Styles ─────────────────────────────────────────────────────────────────────
const sc = StyleSheet.create({
  wrap: {
    gap:       10,
    marginTop: 20,
  },
  card: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             10,
    height:          60,
    backgroundColor: BG,
    borderRadius:    14,
    paddingHorizontal: 14,
    marginHorizontal:  20,
  },
  body: {
    flex: 1,
  },
  emoji:    { fontSize: 16 },
  cardTitle: { fontSize: 13, fontWeight: '500', color: TEXT, lineHeight: 18 },
  cardSub:   { fontSize: 12, color: MUTED, marginTop: 2 },
  dismiss:   { fontSize: 14, color: ACCENT, fontWeight: '600' },
});
