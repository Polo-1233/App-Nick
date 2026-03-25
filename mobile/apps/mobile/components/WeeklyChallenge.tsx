/**
 * WeeklyChallenge — Compact challenge card for the Home Screen
 *
 * Shows the current week's R90 challenge with progress bar.
 * Displayed as a SecondaryCard-style element.
 */

import { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  getActiveChallenge,
  getChallengeProgress,
  type Challenge,
  type ChallengeProgress,
} from '../lib/challenges';

const CARD = '#141466';
const TEXT_W = '#FFFFFF';
const MUTED = '#6B8CAE';

export function WeeklyChallenge() {
  const [challenge, setChallenge]   = useState<Challenge | null>(null);
  const [progress, setProgress]     = useState<ChallengeProgress | null>(null);

  useEffect(() => {
    const ch = getActiveChallenge();
    setChallenge(ch);
    getChallengeProgress().then(setProgress).catch(() => {});
  }, []);

  if (!challenge || !progress) return null;

  const pct = Math.min(1, progress.current / challenge.target);

  return (
    <View style={[wc.card, { borderColor: `${challenge.color}25` }]}>
      <View style={wc.topRow}>
        <View style={[wc.iconWrap, { backgroundColor: `${challenge.color}18` }]}>
          <Ionicons name={challenge.icon as any} size={16} color={challenge.color} />
        </View>
        <View style={wc.textArea}>
          <Text style={wc.title}>{challenge.title}</Text>
          <Text style={wc.desc}>{challenge.description}</Text>
        </View>
        <Text style={[wc.progress, { color: challenge.color }]}>
          {progress.current}/{challenge.target}
        </Text>
      </View>

      {/* Progress bar */}
      <View style={wc.barBg}>
        <View style={[wc.barFill, {
          width: `${Math.max(3, pct * 100)}%` as any,
          backgroundColor: challenge.color,
        }]} />
      </View>

      {/* Completion */}
      {progress.completed && (
        <View style={wc.completedRow}>
          <Ionicons name="checkmark-circle" size={14} color={challenge.color} />
          <Text style={[wc.completedText, { color: challenge.color }]}>
            Challenge complete! +{challenge.bonusPoints} points
          </Text>
        </View>
      )}
    </View>
  );
}

const wc = StyleSheet.create({
  card: {
    backgroundColor: CARD,
    borderRadius:    16,
    padding:         14,
    marginHorizontal: 20,
    gap:             10,
    borderWidth:     1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           12,
  },
  iconWrap: {
    width:        34,
    height:       34,
    borderRadius: 10,
    alignItems:   'center',
    justifyContent: 'center',
  },
  textArea: {
    flex: 1,
    gap:  2,
  },
  title: {
    fontSize:   13,
    fontWeight: '700',
    color:      TEXT_W,
  },
  desc: {
    fontSize: 11,
    color:    MUTED,
  },
  progress: {
    fontSize:   14,
    fontWeight: '800',
  },
  barBg: {
    height:          4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius:    2,
    overflow:        'hidden',
  },
  barFill: {
    height:       4,
    borderRadius: 2,
  },
  completedRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
  },
  completedText: {
    fontSize:   11,
    fontWeight: '600',
  },
});
