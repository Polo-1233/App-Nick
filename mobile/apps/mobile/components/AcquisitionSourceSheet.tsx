/**
 * AcquisitionSourceSheet — "How did you hear about us?" bottom sheet.
 *
 * Shown once, immediately after the onboarding + permission flow completes.
 * White card slides up from bottom over a dimmed backdrop.
 *
 * Behaviour:
 *   - Single-select list; "Other" reveals a text input.
 *   - "Start" enabled only when a valid selection exists.
 *   - "Skip" always available — saves source = 'skipped'.
 *   - Backdrop tap dismisses only if the user already selected something.
 *   - Calls onDone() after save + slide-out animation (navigates caller to Home).
 */

import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HapticsLight } from '../utils/haptics';
import { saveAcquisitionSource } from '../lib/storage';

// ─── Data ─────────────────────────────────────────────────────────────────────

const SOURCES = [
  { id: 'instagram', label: 'Instagram' },
  { id: 'youtube',   label: 'YouTube' },
  { id: 'podcast',   label: 'Podcast' },
  { id: 'friend',    label: 'Friend / Word of mouth' },
  { id: 'google',    label: 'Google Search' },
  { id: 'nick',      label: 'Nick Littlehales' },
  { id: 'other',     label: 'Other' },
] as const;

type SourceId = typeof SOURCES[number]['id'];

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  /** Called after save + slide-out animation. Caller should navigate to Home. */
  onDone: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AcquisitionSourceSheet({ visible, onDone }: Props) {
  const insets = useSafeAreaInsets();

  const [selected,  setSelected]  = useState<SourceId | ''>('');
  const [otherText, setOtherText] = useState('');

  const backdropOp   = useRef(new Animated.Value(0)).current;
  const cardY        = useRef(new Animated.Value(600)).current;
  const dismissing   = useRef(false);

  const canStart =
    selected !== '' &&
    (selected !== 'other' || otherText.trim().length > 0);

  // Animate in when the sheet becomes visible
  useEffect(() => {
    if (!visible) return;
    dismissing.current = false;
    Animated.parallel([
      Animated.timing(backdropOp, {
        toValue: 1, duration: 240, useNativeDriver: true,
      }),
      Animated.spring(cardY, {
        toValue: 0, damping: 22, stiffness: 220, useNativeDriver: true,
      }),
    ]).start();
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  function dismiss(callback: () => void) {
    if (dismissing.current) return;
    dismissing.current = true;
    Keyboard.dismiss();
    Animated.parallel([
      Animated.timing(backdropOp, {
        toValue: 0, duration: 200, useNativeDriver: true,
      }),
      Animated.timing(cardY, {
        toValue: 600, duration: 220, useNativeDriver: true,
      }),
    ]).start(() => callback());
  }

  function persistAndDismiss(source: string, text: string) {
    // Fire-and-forget — analytics data, must never block navigation
    saveAcquisitionSource({
      source,
      otherText: text,
      createdAt: new Date().toISOString(),
    }).catch(() => {});
    dismiss(onDone);
  }

  function handleStart() {
    if (!canStart) return;
    HapticsLight();
    persistAndDismiss(
      selected,
      selected === 'other' ? otherText.trim() : '',
    );
  }

  function handleSkip() {
    persistAndDismiss('skipped', '');
  }

  function handleBackdropPress() {
    // Only dismiss via backdrop if user already made a selection
    if (selected !== '') handleSkip();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleSkip}
    >
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Dimmed backdrop — box-none so the card above it captures its own touches */}
        <Animated.View
          pointerEvents="box-none"
          style={[s.backdrop, { opacity: backdropOp }]}
        >
          <Pressable style={s.flex} onPress={handleBackdropPress} />
        </Animated.View>

        {/* White bottom sheet card */}
        <Animated.View
          style={[
            s.card,
            {
              paddingBottom: Math.max(insets.bottom, 16),
              transform: [{ translateY: cardY }],
            },
          ]}
        >
          {/* Drag handle */}
          <View style={s.handle} />

          {/* Header */}
          <Text style={s.title}>Quick question before we start…</Text>
          <Text style={s.subtitle}>Helps us improve the experience.</Text>

          {/* Source options */}
          <View style={s.options}>
            {SOURCES.map(src => {
              const active = selected === src.id;
              return (
                <Pressable
                  key={src.id}
                  style={[s.option, active && s.optionActive]}
                  onPress={() => {
                    HapticsLight();
                    setSelected(src.id);
                  }}
                >
                  <View style={[s.radio, active && s.radioActive]}>
                    {active && <View style={s.radioDot} />}
                  </View>
                  <Text style={[s.optionTxt, active && s.optionTxtActive]}>
                    {src.label}
                  </Text>
                </Pressable>
              );
            })}

            {/* "Other" free-text — revealed only when selected */}
            {selected === 'other' && (
              <TextInput
                style={s.otherInput}
                value={otherText}
                onChangeText={setOtherText}
                placeholder="Type here…"
                placeholderTextColor="#AAAAAA"
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleStart}
              />
            )}
          </View>

          {/* Primary CTA */}
          <Pressable
            style={[s.startBtn, !canStart && s.startBtnOff]}
            onPress={handleStart}
            disabled={!canStart}
          >
            <Text style={[s.startTxt, !canStart && s.startTxtOff]}>
              Start
            </Text>
          </Pressable>

          {/* Secondary — always available */}
          <Pressable style={s.skipBtn} onPress={handleSkip}>
            <Text style={s.skipTxt}>Skip</Text>
          </Pressable>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const GREEN = '#22C55E';

const s = StyleSheet.create({
  flex: {
    flex: 1,
    justifyContent: 'flex-end',
  },

  // Semi-transparent backdrop fills the entire screen
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },

  // White card anchored to bottom
  card: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
    paddingTop:        12,
    paddingHorizontal: 24,
    shadowColor:    '#000000',
    shadowOffset:   { width: 0, height: -4 },
    shadowOpacity:  0.07,
    shadowRadius:   20,
    elevation:      16,
  },

  handle: {
    width:        40,
    height:       4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf:    'center',
    marginBottom: 20,
  },

  title: {
    color:         '#111111',
    fontSize:      18,
    fontWeight:    '700',
    letterSpacing: -0.3,
    marginBottom:  6,
  },
  subtitle: {
    color:        '#9CA3AF',
    fontSize:     13,
    marginBottom: 18,
  },

  options: {
    gap:          4,
    marginBottom: 20,
  },
  option: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               12,
    paddingVertical:   10,
    paddingHorizontal: 14,
    borderRadius:      12,
    borderWidth:       1.5,
    borderColor:       'transparent',
  },
  optionActive: {
    backgroundColor: '#F0FDF4',
    borderColor:     GREEN,
  },

  radio: {
    width:          20,
    height:         20,
    borderRadius:   10,
    borderWidth:    2,
    borderColor:    '#D1D5DB',
    justifyContent: 'center',
    alignItems:     'center',
  },
  radioActive: {
    borderColor: GREEN,
  },
  radioDot: {
    width:           10,
    height:          10,
    borderRadius:    5,
    backgroundColor: GREEN,
  },

  optionTxt: {
    color:      '#374151',
    fontSize:   15,
    fontWeight: '500',
  },
  optionTxtActive: {
    color:      '#166534',
    fontWeight: '600',
  },

  otherInput: {
    marginTop:         4,
    marginHorizontal:  2,
    borderWidth:       1,
    borderColor:       '#D1D5DB',
    borderRadius:      10,
    paddingVertical:   11,
    paddingHorizontal: 14,
    fontSize:          15,
    color:             '#111111',
    backgroundColor:   '#F9FAFB',
  },

  startBtn: {
    backgroundColor: GREEN,
    borderRadius:    14,
    paddingVertical: 17,
    alignItems:      'center',
    marginBottom:    10,
  },
  startBtnOff: {
    backgroundColor: '#E5E7EB',
  },
  startTxt: {
    color:      '#FFFFFF',
    fontSize:   16,
    fontWeight: '700',
  },
  startTxtOff: {
    color: '#9CA3AF',
  },

  skipBtn: {
    alignItems:     'center',
    paddingVertical: 10,
  },
  skipTxt: {
    color:      '#9CA3AF',
    fontSize:   14,
    fontWeight: '500',
  },
});
