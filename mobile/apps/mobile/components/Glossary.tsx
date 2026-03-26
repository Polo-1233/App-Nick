/**
 * Glossary — R90 terms explained in plain language
 *
 * Bottom sheet with all key terms. Accessible from Profile menu,
 * R-Lo chat, or long-press on metrics.
 */

import { useState } from 'react';
import {
  View, Text, Pressable, ScrollView, StyleSheet, Modal, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const CARD    = '#141466';
const BORDER  = '#1c1c7a';
const ACCENT  = '#1c9fda';
const TEXT_W  = '#E6EDF7';
const TEXT_S  = '#9FB0C5';
const TEXT_M  = '#6B7F99';

interface GlossaryEntry {
  term:       string;
  definition: string;
  icon:       string;
}

const GLOSSARY_ENTRIES: GlossaryEntry[] = [
  { term: 'Sleep Cycle',                       icon: 'refresh-circle',    definition: 'A 90-minute block of sleep going through Light → Deep → REM → Brief Wake. Your entire sleep is built from these.' },
  { term: 'ARP (Anchor Resting Position)',     icon: 'sunny',             definition: 'Your ideal wake-up time. Everything in R90 is calculated backwards from this single anchor.' },
  { term: 'Reset Moment (MRM)',                icon: 'flash',             definition: 'A 2-minute micro-pause at minute 80 of each daytime cycle. Resets your focus and rhythm.' },
  { term: 'Recovery Pause (CRP)',              icon: 'battery-charging',  definition: 'A 20-minute afternoon recovery. Splits the day in two halves. Athletes swear by it.' },
  { term: 'Wind-down',                         icon: 'moon',              definition: 'Your 60-minute pre-sleep routine. Dim lights, cool room, no screens. Signals your body that sleep is coming.' },
  { term: 'Rhythm Flow',                       icon: 'flame',             definition: 'Your streak of consecutive days aligned with your R90 plan. A 2-day grace period applies before it resets.' },
  { term: 'Rhythm Depth',                      icon: 'layers',            definition: 'Your hidden mastery level (Aware → Tuned → Calibrated → Locked → Mastered). Rises with sustained consistency.' },
  { term: 'Rhythm Points',                     icon: 'star',              definition: 'Points earned for each action: confirm wake (+5), reset moment (+2), recovery pause (+5), wind-down (+3).' },
  { term: 'Chronotype',                        icon: 'time',              definition: 'Your natural sleep tendency: AMer (early bird), PMer (night owl), or Intermediate.' },
  { term: 'Weekly Target',                     icon: 'calendar',          definition: '35 cycles per week (5 per night × 7). Not every night needs to be perfect — the week matters.' },
  { term: 'R90 Score',                         icon: 'stats-chart',       definition: 'A weighted composite of your 7 sleep performance indicators (KSPIs). Ranges 0-100.' },
  { term: 'KSPI',                              icon: 'bar-chart',         definition: 'Key Sleep Performance Indicator. 7 pillars: Cycles, Circadian, Chronotype, Pre-sleep, Post-sleep, Environment, Recovery.' },
  { term: 'Anchor Time',                       icon: 'alarm',             definition: 'Your fixed wake-up time that anchors your entire 90-minute cycle. Held constant 7 days a week — even on weekends.' },
  { term: 'Sleep Cycle (90 min)',              icon: 'refresh',           definition: 'A complete sleep cycle lasting ~90 minutes, moving through 4 stages: Light → Deep → Very Deep → REM.' },

  { term: 'Nick Littlehales',                  icon: 'person',            definition: 'Creator of the R90 method. 35+ years of experience, sleep coach to Ronaldo, Manchester United, and Team Sky. Former president of the UK Sleep Council.' },
  { term: 'R-Lo',                              icon: 'happy',             definition: 'Your personal R90 companion. R-Lo guides you through the methodology, keeps you on track, and celebrates your progress.' },
  { term: 'Pre-Sleep Routine',                 icon: 'partly-sunny',      definition: 'The 60-minute wind-down window before sleep. Controls light exposure, temperature, and mental decompression to prime deep recovery.' },
];

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function Glossary({ visible, onClose }: Props) {
  const [search, setSearch] = useState('');

  const filtered = search.trim()
    ? GLOSSARY_ENTRIES.filter(e =>
        e.term.toLowerCase().includes(search.toLowerCase()) ||
        e.definition.toLowerCase().includes(search.toLowerCase())
      )
    : GLOSSARY_ENTRIES;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} />
      <View style={s.sheet}>
        <View style={s.handle} />
        <Text style={s.title}>R90 Glossary</Text>

        {/* Search */}
        <View style={s.searchWrap}>
          <Ionicons name="search" size={16} color={TEXT_M} />
          <TextInput
            style={s.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search terms..."
            placeholderTextColor={TEXT_M}
          />
        </View>

        {/* Entries */}
        <ScrollView style={s.list} showsVerticalScrollIndicator={false}>
          {filtered.map((entry, i) => (
            <View key={i} style={s.entry}>
              <View style={s.entryHeader}>
                <Ionicons name={entry.icon as any} size={16} color={ACCENT} />
                <Text style={s.entryTerm}>{entry.term}</Text>
              </View>
              <Text style={s.entryDef}>{entry.definition}</Text>
            </View>
          ))}
          {filtered.length === 0 && (
            <Text style={s.emptyText}>No matching terms</Text>
          )}
          <View style={{ height: 20 }} />
        </ScrollView>

        <Pressable style={s.closeBtn} onPress={onClose}>
          <Text style={s.closeTxt}>Close</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: CARD, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 12, paddingHorizontal: 24, paddingBottom: 40,
    maxHeight: '85%', gap: 12,
    borderTopWidth: 1, borderTopColor: BORDER,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'center', marginBottom: 8,
  },
  title: { fontSize: 20, fontWeight: '700', color: TEXT_W },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: BORDER,
  },
  searchInput: {
    flex: 1, fontSize: 14, color: TEXT_W,
  },

  list: { flex: 1 },
  entry: {
    paddingVertical: 14, gap: 6,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  entryHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  entryTerm: {
    fontSize: 15, fontWeight: '700', color: TEXT_W,
  },
  entryDef: {
    fontSize: 13, color: TEXT_S, lineHeight: 19, marginLeft: 24,
  },
  emptyText: {
    fontSize: 14, color: TEXT_M, textAlign: 'center', paddingVertical: 32,
  },

  closeBtn: {
    backgroundColor: ACCENT, borderRadius: 14, paddingVertical: 14, alignItems: 'center',
  },
  closeTxt: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
