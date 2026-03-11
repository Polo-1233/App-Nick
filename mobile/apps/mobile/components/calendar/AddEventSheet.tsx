/**
 * AddEventSheet — minimal "add event" bottom sheet (V1).
 *
 * Fields: title (TextInput) + start time + end time (native DateTimePicker).
 * Calls onSave(title, startMin, endMin) when the user confirms.
 *
 * Android: DateTimePicker opens as a native system dialog.
 * iOS:     DateTimePicker renders as an inline spinner.
 *
 * Time values are MinuteOfDay (0–1439), consistent with the rest of the app.
 */

import { useState, useRef, useEffect } from 'react';
import {
  Animated,
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
} from 'react-native';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Called with (title, startMin, endMin) when the user saves. */
  onSave:  (title: string, startMin: number, endMin: number) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function minToDate(minutes: number): Date {
  const d = new Date();
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return d;
}

function dateToMin(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function fmtMin(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

// ─── AddEventSheet ────────────────────────────────────────────────────────────

export function AddEventSheet({ visible, onClose, onSave }: Props) {
  const backdropOp = useRef(new Animated.Value(0)).current;
  const cardY      = useRef(new Animated.Value(500)).current;
  const mounted    = useRef(true);

  const [title,       setTitle]       = useState('');
  const [startMin,    setStartMin]    = useState(9 * 60);   // 09:00
  const [endMin,      setEndMin]      = useState(10 * 60);  // 10:00
  const [pickerField, setPickerField] = useState<'start' | 'end' | null>(null);

  useEffect(() => { return () => { mounted.current = false; }; }, []);

  useEffect(() => {
    if (visible) {
      backdropOp.setValue(0);
      cardY.setValue(500);
      Animated.parallel([
        Animated.timing(backdropOp, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(cardY, {
          toValue:   0,
          damping:   22,
          stiffness: 260,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      if (mounted.current) {
        // Reset fields after closing so they're fresh next time
        setTimeout(() => {
          if (mounted.current) {
            setTitle('');
            setStartMin(9 * 60);
            setEndMin(10 * 60);
            setPickerField(null);
          }
        }, 300);
      }
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSave() {
    if (!title.trim()) return;
    onSave(title.trim(), startMin, endMin);
    onClose();
  }

  function handleTimeChange(_evt: DateTimePickerEvent, date?: Date) {
    if (!date) { setPickerField(null); return; }
    const m = dateToMin(date);
    if (pickerField === 'start') {
      setStartMin(m);
      // Auto-advance end time if it would be before or equal to start
      if (m >= endMin) setEndMin(Math.min(m + 60, 23 * 60 + 59));
    } else {
      setEndMin(m);
    }
    // On Android the system dialog closes itself; on iOS we leave the picker open
    if (Platform.OS === 'android') setPickerField(null);
  }

  const canSave = title.trim().length > 0;

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

      {/* ── Sheet ── */}
      <Animated.View style={[s.sheet, { transform: [{ translateY: cardY }] }]}>
        <View style={s.handle} />

        {/* Header */}
        <View style={s.header}>
          <Text style={s.headerTitle}>New Event</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={s.closeX}>✕</Text>
          </Pressable>
        </View>

        {/* Title input */}
        <TextInput
          style={s.titleInput}
          placeholder="Event title"
          placeholderTextColor="#6B7280"
          value={title}
          onChangeText={setTitle}
          returnKeyType="done"
        />

        {/* Time row */}
        <View style={s.timeRow}>
          <Pressable
            style={[s.timeField, pickerField === 'start' && s.timeFieldActive]}
            onPress={() => setPickerField('start')}
          >
            <Text style={s.timeLabel}>Start</Text>
            <Text style={s.timeValue}>{fmtMin(startMin)}</Text>
          </Pressable>

          <Text style={s.arrow}>→</Text>

          <Pressable
            style={[s.timeField, pickerField === 'end' && s.timeFieldActive]}
            onPress={() => setPickerField('end')}
          >
            <Text style={s.timeLabel}>End</Text>
            <Text style={s.timeValue}>{fmtMin(endMin)}</Text>
          </Pressable>
        </View>

        {/* Native time picker — Android opens a system dialog; iOS shows inline */}
        {pickerField !== null && (
          <DateTimePicker
            value={minToDate(pickerField === 'start' ? startMin : endMin)}
            mode="time"
            is24Hour
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleTimeChange}
          />
        )}

        {/* Save button */}
        <Pressable
          style={[s.saveBtn, !canSave && s.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!canSave}
        >
          <Text style={s.saveBtnTxt}>Save Event</Text>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    position:             'absolute',
    bottom:               0,
    left:                 0,
    right:                0,
    backgroundColor:      '#131313',
    borderTopLeftRadius:  22,
    borderTopRightRadius: 22,
    paddingHorizontal:    20,
    paddingBottom:        40,
    shadowColor:          '#000',
    shadowOffset:         { width: 0, height: -8 },
    shadowOpacity:        0.4,
    shadowRadius:         24,
    elevation:            24,
  },
  handle: {
    width:           36,
    height:          4,
    borderRadius:    2,
    backgroundColor: '#3A3A3A',
    alignSelf:       'center',
    marginTop:       12,
    marginBottom:    16,
  },
  header: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    marginBottom:    20,
  },
  headerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  closeX:      { color: '#6B7280', fontSize: 16 },
  titleInput: {
    backgroundColor:   '#1C1C1C',
    borderRadius:      10,
    paddingHorizontal: 14,
    paddingVertical:   12,
    color:             '#FFFFFF',
    fontSize:          16,
    marginBottom:      16,
    borderWidth:       1,
    borderColor:       '#2A2A2A',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           12,
    marginBottom:  24,
  },
  timeField: {
    flex:            1,
    backgroundColor: '#1C1C1C',
    borderRadius:    10,
    padding:         14,
    borderWidth:     1,
    borderColor:     '#2A2A2A',
  },
  timeFieldActive: { borderColor: '#22C55E' },
  timeLabel:  { color: '#6B7280', fontSize: 11, marginBottom: 4 },
  timeValue: {
    color:       '#FFFFFF',
    fontSize:    22,
    fontWeight:  '600',
    fontVariant: ['tabular-nums'],
  },
  arrow: { color: '#4B5563', fontSize: 18 },
  saveBtn: {
    backgroundColor: '#22C55E',
    borderRadius:    12,
    paddingVertical: 14,
    alignItems:      'center',
  },
  saveBtnDisabled: { backgroundColor: '#1A3A20', opacity: 0.6 },
  saveBtnTxt: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
