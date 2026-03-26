/**
 * SessionIntro — Multi-step first-time intro for MRM / CRP / Wind-down
 *
 * Replaces the single-screen modal with a 2-3 step mini-onboarding.
 * Each session type has its own copy tailored to R90 methodology.
 *
 * Props:
 *   visible     — controls Modal visibility
 *   sessionType — 'mrm' | 'crp' | 'winddown'
 *   onStart     — user tapped the final CTA
 *   onSkip      — user tapped Skip at any point
 */

import { useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, Modal,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MascotImage, type MascotEmotion } from './ui/MascotImage';

// ─── Palette ──────────────────────────────────────────────────────────────────
const BG     = '#0a0a3a';
const CARD   = '#141466';
const BORDER = '#1c1c7a';
const ACCENT = '#1c9fda';
const GOLD   = '#F5A623';
const PURPLE = '#8B5CF6';
const TEXT_W = '#FFFFFF';
const TEXT_S = '#9FB0C5';
const TEXT_M = '#6B8CAE';

// ─── Types ────────────────────────────────────────────────────────────────────
export type SessionType = 'mrm' | 'crp' | 'winddown';

interface Bullet {
  icon: string;
  label: string;
}

interface IntroStep {
  title:       string;
  body:        string;
  bullets?:    Bullet[];
  note?:       string;
  mascot?:     MascotEmotion;
  cta?:        string;          // only shown on last step
  accentColor?: string;
}

// ─── Step definitions ─────────────────────────────────────────────────────────
const INTRO_STEPS: Record<SessionType, IntroStep[]> = {
  mrm: [
    {
      title:   'Reset Moment (MRM)',
      body:    "Nick Littlehales found that elite athletes use 2-minute micro-pauses between activity cycles to maintain peak performance. This is your Reset Moment.",
      mascot:  'Enthousisate',
      accentColor: ACCENT,
    },
    {
      title:   'How it works',
      body:    'Three simple steps to reset your focus and energy:',
      bullets: [
        { icon: 'eye-off',  label: 'Close your eyes' },
        { icon: 'cellular', label: 'Breathe deeply and slowly' },
        { icon: 'flash',    label: 'Restart with full focus' },
      ],
      note:    "2 minutes. That's all it takes.",
      mascot:  'rassurante',
      accentColor: ACCENT,
    },
    {
      title:   'When to do it',
      body:    "Nick recommends a Reset Moment every 90 minutes throughout the day — at the natural transition between your activity cycles. The app will remind you at the right time.",
      cta:     'Start my first Reset Moment',
      accentColor: ACCENT,
    },
  ],

  crp: [
    {
      title:   'Recovery Pause (CRP)',
      body:    "Team Sky cyclists used 20-minute afternoon recovery pauses after lunch. Nick calls this a CRP — Controlled Recovery Period. It splits the day into two performance halves.",
      mascot:  'encourageant',
      accentColor: GOLD,
    },
    {
      title:   'This is NOT a nap',
      body:    "A CRP never exceeds half a cycle (30 min max). You don't fall into deep sleep. You recharge without the grogginess.",
      bullets: [
        { icon: 'battery-charging', label: 'CRP — 20 min, chair or sofa' },
        { icon: 'bed',              label: 'Nap — 90 min, bed required' },
      ],
      note:    'The difference: wake up sharp, not heavy.',
      mascot:  'Reflexion',
      accentColor: GOLD,
    },
    {
      title:   'The right window',
      body:    'The ideal window is between 1 PM and 3 PM — the natural low point in your circadian rhythm. Your body is already primed for recovery.',
      cta:     'Start my Recovery Pause',
      accentColor: GOLD,
    },
  ],

  winddown: [
    {
      title:   'Your Wind-down Zone',
      body:    "The last hour before sleep determines the quality of your entire night. Nick calls this the Wind-down Zone — five environmental factors that signal sleep is coming.",
      bullets: [
        { icon: 'sunny',          label: 'Dim the lights' },
        { icon: 'thermometer',    label: 'Cool the room' },
        { icon: 'phone-portrait', label: 'No screens' },
        { icon: 'cafe',           label: 'No caffeine' },
        { icon: 'book-outline',   label: 'Quiet the mind' },
      ],
      mascot:  'rassurante',
      accentColor: PURPLE,
    },
    {
      title:   'How the app helps',
      body:    'We walk you through an environment checklist, an optional sleep story, and a quick mood check. 10 minutes max. Your best nights start here.',
      cta:     'Start my routine',
      accentColor: PURPLE,
    },
  ],
};

// ─── Component ────────────────────────────────────────────────────────────────
interface Props {
  visible:     boolean;
  sessionType: SessionType;
  onStart:     () => void;
  onSkip:      () => void;
}

export function SessionIntro({ visible, sessionType, onStart, onSkip }: Props) {
  const [step, setStep] = useState(0);
  const steps           = INTRO_STEPS[sessionType];
  const current         = steps[step];
  const isLast          = step === steps.length - 1;
  const accent          = current.accentColor ?? ACCENT;

  function handleNext() {
    if (isLast) {
      setStep(0);   // reset for next time
      onStart();
    } else {
      setStep(s => s + 1);
    }
  }

  function handleSkip() {
    setStep(0);
    onSkip();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleSkip}>
      <View style={s.overlay}>
        <View style={s.sheet}>

          {/* Handle */}
          <View style={s.handle} />

          {/* Skip */}
          <Pressable style={s.skipBtn} onPress={handleSkip}>
            <Text style={s.skipTxt}>Skip</Text>
          </Pressable>

          {/* Content */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.content}
          >
            {/* Mascot (first step) */}
            {current.mascot && (
              <MascotImage emotion={current.mascot} size="md" style={s.mascot} />
            )}

            {/* Title */}
            <Text style={[s.title, { color: accent }]}>{current.title}</Text>

            {/* Body */}
            <Text style={s.body}>{current.body}</Text>

            {/* Bullets */}
            {current.bullets && current.bullets.length > 0 && (
              <View style={s.bulletList}>
                {current.bullets.map((b, i) => (
                  <View key={i} style={s.bulletRow}>
                    <View style={[s.bulletIcon, { backgroundColor: accent + '22' }]}>
                      <Ionicons name={b.icon as any} size={16} color={accent} />
                    </View>
                    <Text style={s.bulletLabel}>{b.label}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Inline note */}
            {current.note && (
              <View style={[s.noteWrap, { borderLeftColor: accent }]}>
                <Text style={s.noteTxt}>{current.note}</Text>
              </View>
            )}
          </ScrollView>

          {/* Dots */}
          {steps.length > 1 && (
            <View style={s.dotsRow}>
              {steps.map((_, i) => (
                <View
                  key={i}
                  style={[
                    s.dot,
                    i === step
                      ? { backgroundColor: accent, width: 20 }
                      : { backgroundColor: BORDER },
                  ]}
                />
              ))}
            </View>
          )}

          {/* CTA */}
          <Pressable
            style={[s.cta, { backgroundColor: accent }]}
            onPress={handleNext}
          >
            <Text style={s.ctaTxt}>
              {isLast
                ? (current.cta ?? 'Start')
                : 'Next'}
            </Text>
            {!isLast && (
              <Ionicons name="arrow-forward" size={16} color="#fff" />
            )}
          </Pressable>

        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: CARD,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    paddingHorizontal: 24,
    paddingBottom: 48,
    maxHeight: '88%',
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center', marginBottom: 8,
  },
  skipBtn: {
    alignSelf: 'flex-end',
    paddingVertical: 4, paddingHorizontal: 8, marginBottom: 8,
  },
  skipTxt: { fontSize: 13, color: TEXT_M },

  content: { gap: 16, paddingBottom: 8 },

  mascot: { alignSelf: 'center', marginBottom: 4 },

  title: {
    fontSize: 22, fontWeight: '800', lineHeight: 30,
    textAlign: 'center',
  },
  body: {
    fontSize: 15, color: TEXT_S, lineHeight: 24,
    textAlign: 'center',
  },

  bulletList: { gap: 10, marginTop: 4 },
  bulletRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  bulletIcon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  bulletLabel: { fontSize: 14, color: TEXT_W, flex: 1 },

  noteWrap: {
    borderLeftWidth: 3, paddingLeft: 12, marginTop: 4,
  },
  noteTxt: { fontSize: 13, color: TEXT_S, fontStyle: 'italic', lineHeight: 20 },

  dotsRow: {
    flexDirection: 'row', justifyContent: 'center', gap: 6,
    marginTop: 20, marginBottom: 16,
  },
  dot: {
    height: 6, borderRadius: 3, width: 8,
  },

  cta: {
    borderRadius: 16, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8,
  },
  ctaTxt: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
