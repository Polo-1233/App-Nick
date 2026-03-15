/**
 * life-events.tsx — Log significant life events
 *
 * Events R-Lo uses to contextualize coaching:
 *   travel, illness, high_stress, late_night, important_day, celebration, other
 *
 * Shows: list of recent/upcoming events + add new event form.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, Pressable, StyleSheet,
  ScrollView, TextInput, ActivityIndicator, Alert, Modal,
} from 'react-native';
import { SafeAreaView }  from 'react-native-safe-area-context';
import { useRouter }     from 'expo-router';
import { Ionicons }      from '@expo/vector-icons';
import {
  getLifeEvents, createLifeEvent, deleteLifeEvent,
  type LifeEvent,
} from '../lib/api';

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  bg: '#0B1220', card: '#1A2436', surface2: '#243046',
  accent: '#4DA3FF', text: '#E6EDF7', sub: '#9FB0C5',
  muted: '#6B7F99', border: 'rgba(255,255,255,0.06)',
  success: '#3DDC97', warning: '#F5A623', error: '#F87171',
};

// ─── Event type config ────────────────────────────────────────────────────────
const EVENT_TYPES: Record<string, { label: string; icon: string; color: string }> = {
  travel:       { label: 'Travel',        icon: 'airplane-outline',      color: '#4DA3FF' },
  illness:      { label: 'Illness',       icon: 'medical-outline',       color: '#F87171' },
  high_stress:  { label: 'High stress',   icon: 'warning-outline',       color: '#F5A623' },
  late_night:   { label: 'Late night',    icon: 'moon-outline',          color: '#9B59B6' },
  important_day:{ label: 'Important day', icon: 'star-outline',          color: '#F5A623' },
  celebration:  { label: 'Celebration',   icon: 'happy-outline',         color: '#3DDC97' },
  other:        { label: 'Other',         icon: 'ellipsis-horizontal-outline', color: '#6B7F99' },
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function formatDate(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
function isUpcoming(iso: string) {
  return iso >= todayISO();
}

// ─── EventRow ─────────────────────────────────────────────────────────────────
function EventRow({ event, onDelete }: { event: LifeEvent; onDelete: () => void }) {
  const cfg = EVENT_TYPES[event.event_type] ?? EVENT_TYPES.other!;
  const upcoming = isUpcoming(event.event_date);
  return (
    <View style={er.row}>
      <View style={[er.iconBox, { backgroundColor: `${cfg.color}18` }]}>
        <Ionicons name={cfg.icon as any} size={20} color={cfg.color} />
      </View>
      <View style={er.body}>
        <Text style={er.title}>{event.title}</Text>
        <Text style={er.meta}>
          {cfg.label} · {formatDate(event.event_date)}
          {event.end_date && event.end_date !== event.event_date ? ` → ${formatDate(event.end_date)}` : ''}
          {upcoming ? '  📅' : ''}
        </Text>
        {event.notes ? <Text style={er.notes}>{event.notes}</Text> : null}
      </View>
      <Pressable hitSlop={10} onPress={onDelete} style={er.del}>
        <Ionicons name="trash-outline" size={17} color={C.muted} />
      </Pressable>
    </View>
  );
}
const er = StyleSheet.create({
  row:    { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginHorizontal: 16, marginBottom: 10, backgroundColor: C.card, borderRadius: 14, padding: 14 },
  iconBox:{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  body:   { flex: 1, gap: 3 },
  title:  { fontSize: 14, fontWeight: '700', color: C.text },
  meta:   { fontSize: 12, color: C.muted },
  notes:  { fontSize: 12, color: C.sub, marginTop: 2 },
  del:    { padding: 4 },
});

// ─── Add Event Modal ──────────────────────────────────────────────────────────
function AddEventModal({
  visible, onClose, onAdded,
}: { visible: boolean; onClose: () => void; onAdded: () => void }) {
  const [type,      setType]      = useState('travel');
  const [title,     setTitle]     = useState('');
  const [date,      setDate]      = useState(todayISO());
  const [endDate,   setEndDate]   = useState('');
  const [notes,     setNotes]     = useState('');
  const [saving,    setSaving]    = useState(false);

  async function handleAdd() {
    if (!title.trim()) { Alert.alert('Title required', 'Please add a short description.'); return; }
    if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) { Alert.alert('Invalid date', 'Format: YYYY-MM-DD'); return; }
    setSaving(true);
    try {
      const result = await createLifeEvent({
        event_type: type,
        title: title.trim(),
        event_date: date,
        end_date: endDate.match(/^\d{4}-\d{2}-\d{2}$/) ? endDate : null,
        notes: notes.trim() || null,
      });
      if (!result.ok) { Alert.alert('Error', result.error ?? 'Could not save event.'); return; }
      setTitle(''); setDate(todayISO()); setEndDate(''); setNotes(''); setType('travel');
      onAdded();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={mod.root} edges={['top', 'bottom']}>
        <View style={mod.header}>
          <Pressable onPress={onClose} hitSlop={10}><Text style={mod.cancel}>Cancel</Text></Pressable>
          <Text style={mod.title}>Add event</Text>
          <Pressable onPress={() => { void handleAdd(); }} disabled={saving}>
            {saving ? <ActivityIndicator size="small" color={C.accent} /> : <Text style={mod.done}>Add</Text>}
          </Pressable>
        </View>

        <ScrollView style={mod.flex} contentContainerStyle={{ paddingBottom: 32 }} keyboardShouldPersistTaps="handled">

          {/* Type */}
          <Text style={mod.label}>Event type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={mod.typeRow}>
            {Object.entries(EVENT_TYPES).map(([val, cfg]) => (
              <Pressable
                key={val}
                style={[mod.typePill, type === val && { backgroundColor: C.accent }]}
                onPress={() => setType(val)}
              >
                <Ionicons name={cfg.icon as any} size={14} color={type === val ? '#000' : C.muted} />
                <Text style={[mod.typeLabel, type === val && { color: '#000' }]}>{cfg.label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Title */}
          <Text style={mod.label}>Description</Text>
          <TextInput
            style={mod.input}
            placeholder="e.g. Flight to Paris, Exam day…"
            placeholderTextColor={C.muted}
            value={title}
            onChangeText={setTitle}
            maxLength={80}
          />

          {/* Date */}
          <Text style={mod.label}>Start date</Text>
          <TextInput
            style={mod.input}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={C.muted}
            value={date}
            onChangeText={setDate}
            keyboardType="numbers-and-punctuation"
            maxLength={10}
          />

          {/* End date (optional) */}
          <Text style={mod.label}>End date <Text style={mod.labelOpt}>(optional — for multi-day events)</Text></Text>
          <TextInput
            style={mod.input}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={C.muted}
            value={endDate}
            onChangeText={setEndDate}
            keyboardType="numbers-and-punctuation"
            maxLength={10}
          />

          {/* Notes */}
          <Text style={mod.label}>Notes <Text style={mod.labelOpt}>(optional)</Text></Text>
          <TextInput
            style={[mod.input, { height: 80, paddingTop: 12 }]}
            placeholder="Any context R-Lo should know…"
            placeholderTextColor={C.muted}
            value={notes}
            onChangeText={setNotes}
            multiline
            maxLength={200}
          />

        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
const mod = StyleSheet.create({
  root:      { flex: 1, backgroundColor: C.bg },
  flex:      { flex: 1 },
  header:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
  title:     { fontSize: 17, fontWeight: '700', color: C.text },
  cancel:    { fontSize: 16, color: C.muted },
  done:      { fontSize: 16, fontWeight: '700', color: C.accent },
  label:     { fontSize: 13, fontWeight: '600', color: C.sub, marginHorizontal: 20, marginTop: 20, marginBottom: 8 },
  labelOpt:  { fontWeight: '400', color: C.muted },
  typeRow:   { paddingHorizontal: 20, gap: 8, paddingBottom: 4 },
  typePill:  { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: C.card },
  typeLabel: { fontSize: 13, fontWeight: '600', color: C.muted },
  input:     { marginHorizontal: 16, backgroundColor: C.card, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, fontSize: 15, color: C.text, borderWidth: 1, borderColor: C.border },
});

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function LifeEventsScreen() {
  const router = useRouter();
  const [events,    setEvents]    = useState<LifeEvent[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await getLifeEvents();
    if (result.ok && result.data?.events) setEvents(result.data.events);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handleDelete(id: string) {
    Alert.alert('Delete event', 'Remove this event from your profile?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await deleteLifeEvent(id);
          setEvents(prev => prev.filter(e => e.id !== id));
        },
      },
    ]);
  }

  const upcoming = events.filter(e => isUpcoming(e.event_date));
  const past     = events.filter(e => !isUpcoming(e.event_date));

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={s.back}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </Pressable>
        <Text style={s.headerTitle}>Life events</Text>
        <Pressable
          style={s.addBtn}
          onPress={() => setShowModal(true)}
        >
          <Ionicons name="add" size={22} color={C.accent} />
        </Pressable>
      </View>

      {loading ? (
        <View style={s.loading}><ActivityIndicator color={C.accent} /></View>
      ) : (
        <ScrollView style={s.flex} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

          <View style={s.intro}>
            <Text style={s.introText}>
              Tell R-Lo about events that affect your sleep — upcoming travel, stressful periods, important days. R-Lo will adjust coaching accordingly.
            </Text>
          </View>

          {upcoming.length > 0 && (
            <>
              <Text style={s.sectionLabel}>UPCOMING</Text>
              {upcoming.map(e => <EventRow key={e.id} event={e} onDelete={() => handleDelete(e.id)} />)}
            </>
          )}

          {past.length > 0 && (
            <>
              <Text style={s.sectionLabel}>RECENT</Text>
              {past.map(e => <EventRow key={e.id} event={e} onDelete={() => handleDelete(e.id)} />)}
            </>
          )}

          {events.length === 0 && (
            <View style={s.empty}>
              <Ionicons name="calendar-outline" size={44} color={C.muted} />
              <Text style={s.emptyText}>No events logged yet</Text>
              <Text style={s.emptySub}>Tap + to add your first event</Text>
            </View>
          )}
        </ScrollView>
      )}

      <AddEventModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        onAdded={() => { void load(); }}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.bg },
  flex:   { flex: 1 },
  scroll: { paddingBottom: 24 },

  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  back:        { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: C.text },
  addBtn:      { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  intro:     { margin: 16, backgroundColor: C.card, borderRadius: 14, padding: 16 },
  introText: { fontSize: 14, color: C.sub, lineHeight: 21 },

  sectionLabel: { fontSize: 11, fontWeight: '700', color: C.muted, letterSpacing: 0.8, marginHorizontal: 16, marginTop: 20, marginBottom: 10 },

  empty:     { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 16, fontWeight: '700', color: C.sub },
  emptySub:  { fontSize: 14, color: C.muted },
});
