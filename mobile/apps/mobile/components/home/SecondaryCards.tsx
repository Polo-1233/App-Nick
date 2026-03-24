/**
 * SecondaryCards
 *
 * Compact info cards below the main action cards.
 * Render NOTHING if no data.
 *
 * Matches reference style: slightly lighter blue cards, smaller, compact.
 * Types: calendar, insight, weekly.
 */

import { memo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const ACCENT     = '#1c9fda';
const GOLD       = '#F5A623';
const CARD_BG    = '#EAF4FB';   // soft blue on white bg
const TEXT_MAIN  = '#002060';
const TEXT_MUTED = '#5A7A9A';

export interface CalendarCard  { type: 'calendar';  title: string; subtitle: string; onDismiss: () => void }
export interface InsightCard   { type: 'insight';   id: string; message: string; onDismiss: () => void }
export interface WeeklyCard    { type: 'weekly';    streakDays: number }
export type SecondaryCardData  = CalendarCard | InsightCard | WeeklyCard;

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
          <View key={i} style={sc.card}>
            <View style={sc.iconWrap}>
              <Text style={{ fontSize: 16 }}>🔆</Text>
            </View>
            <View style={sc.body}>
              <Text style={sc.label}>DID YOU KNOW?</Text>
              <Text style={sc.title} numberOfLines={2}>{card.message}</Text>
            </View>
            <Pressable onPress={card.onDismiss} hitSlop={10}>
              <Text style={sc.dismiss}>✓</Text>
            </Pressable>
          </View>
        );

        if (card.type === 'weekly') return (
          <View key={i} style={sc.card}>
            <View style={sc.iconWrap}>
              <Text style={{ fontSize: 16 }}>📊</Text>
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
    paddingVertical:   12,
    paddingHorizontal: 14,
    borderRadius:      14,
    backgroundColor:   CARD_BG,
    shadowColor:       '#002060',
    shadowOffset:      { width: 0, height: 2 },
    shadowOpacity:     0.05,
    shadowRadius:      8,
    elevation:         1,
  },
  iconWrap: {
    width:           34,
    height:          34,
    borderRadius:    10,
    backgroundColor: `${ACCENT}18`,
    alignItems:      'center',
    justifyContent:  'center',
  },
  body:    { flex: 1 },
  label:   { fontSize: 10, fontWeight: '700', color: GOLD,       letterSpacing: 0.8, marginBottom: 2 },
  title:   { fontSize: 13, fontWeight: '600', color: TEXT_MAIN,  lineHeight: 18 },
  sub:     { fontSize: 12, color: TEXT_MUTED, marginTop: 1 },
  dismiss: { fontSize: 14, color: ACCENT, fontWeight: '700' },
});
