/**
 * support.tsx — Support screen
 *
 * Sections:
 *   1. FAQ         — expandable Q&A
 *   2. Contact     — email support
 *   3. Account     — subscription, restore, delete account
 *   4. About       — privacy, terms, version
 */

import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter }    from 'expo-router';
import { Ionicons }     from '@expo/vector-icons';

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  bg:      '#0B1220',
  card:    '#1A2436',
  surface2:'#243046',
  accent:  '#4DA3FF',
  danger:  '#F87171',
  text:    '#E6EDF7',
  sub:     '#9FB0C5',
  muted:   '#6B7F99',
  border:  'rgba(255,255,255,0.07)',
};

const APP_VERSION = '1.0.0';
const SUPPORT_EMAIL = 'support@r90navigator.com';
const PRIVACY_URL   = 'https://r90navigator.com/privacy';
const TERMS_URL     = 'https://r90navigator.com/terms';
const SUBSCR_URL    = 'https://apps.apple.com/account/subscriptions';

// ─── FAQ data ─────────────────────────────────────────────────────────────────
const FAQ_ITEMS = [
  {
    q: 'How does the sleep plan work?',
    a: "R-Lo · Sleep Coach uses Nick Littlehales' R90 method to build your sleep plan around 90-minute sleep cycles. It calculates your optimal bedtime by working backwards from your wake time in multiples of 90 minutes.",
  },
  {
    q: 'How is my bedtime calculated?',
    a: 'Your bedtime = wake time − (number of cycles × 90 min) − 30 min pre-sleep wind-down. For example, a 07:30 wake with 5 cycles gives a bedtime of 23:00.',
  },
  {
    q: 'What is the R90 method?',
    a: 'The R90 method was developed by sleep coach Nick Littlehales. It focuses on sleep cycles (not hours), recovery across a 7-night window, and consistency of your wake time rather than your bedtime.',
  },
  {
    q: 'Can I change my wake time?',
    a: 'Yes. Go to Profile → Settings to update your anchor wake time. Your bedtime suggestions will recalculate automatically.',
  },
  {
    q: 'What happens if I miss a night?',
    a: "One poor night won't define your week. R90 tracks recovery across 7 nights. R-Lo will suggest how to adjust the next few nights to make up lost cycles.",
  },
];

// ─── FAQ item ─────────────────────────────────────────────────────────────────
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Pressable
      style={({ pressed }) => [fq.item, pressed && { opacity: 0.8 }]}
      onPress={() => setOpen(v => !v)}
    >
      <View style={fq.row}>
        <Text style={fq.question}>{q}</Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={C.muted}
        />
      </View>
      {open && <Text style={fq.answer}>{a}</Text>}
    </Pressable>
  );
}
const fq = StyleSheet.create({
  item:     { paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  row:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  question: { fontSize: 15, fontWeight: '600', color: C.text, flex: 1, lineHeight: 22 },
  answer:   { marginTop: 10, fontSize: 14, color: C.sub, lineHeight: 22 },
});

// ─── Menu row ─────────────────────────────────────────────────────────────────
function MenuRow({
  icon, label, onPress, danger, last,
}: {
  icon: string; label: string; onPress: () => void;
  danger?: boolean; last?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [mr.row, !last && mr.border, pressed && { opacity: 0.7 }]}
      onPress={onPress}
    >
      <View style={[mr.icon, danger && { backgroundColor: `${C.danger}18` }]}>
        <Ionicons name={icon as any} size={18} color={danger ? C.danger : C.accent} />
      </View>
      <Text style={[mr.label, danger && { color: C.danger }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={15} color={C.muted} />
    </Pressable>
  );
}
const mr = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 16 },
  border:{ borderBottomWidth: 1, borderBottomColor: C.border },
  icon:  { width: 36, height: 36, borderRadius: 10, backgroundColor: `${C.accent}15`, alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1, fontSize: 15, color: C.text, fontWeight: '500' },
});

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={sec.wrap}>
      <Text style={sec.title}>{title}</Text>
      <View style={sec.card}>{children}</View>
    </View>
  );
}
const sec = StyleSheet.create({
  wrap:  { marginBottom: 28, paddingHorizontal: 16 },
  title: { fontSize: 12, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10, marginLeft: 2 },
  card:  { backgroundColor: C.card, borderRadius: 18, overflow: 'hidden' },
});

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function SupportScreen() {
  const router = useRouter();

  function openEmail() {
    const url = `mailto:${SUPPORT_EMAIL}?subject=R-Lo · Sleep Coach Support`;
    Linking.openURL(url).catch(() =>
      Alert.alert('Cannot open email', `Send us a message at ${SUPPORT_EMAIL}`)
    );
  }

  function openUrl(url: string) {
    Linking.openURL(url).catch(() =>
      Alert.alert('Cannot open link', url)
    );
  }

  function confirmDeleteAccount() {
    Alert.alert(
      'Delete account',
      'This will permanently delete your account and all data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => Alert.alert('Request sent', 'Our team will process your deletion within 48 hours.'),
        },
      ]
    );
  }

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>

      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={s.back}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </Pressable>
        <View>
          <Text style={s.title}>Support</Text>
          <Text style={s.subtitle}>We're here to help</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* 1. FAQ */}
        <Section title="Frequently Asked Questions">
          {FAQ_ITEMS.map((item, i) => (
            <FaqItem key={i} q={item.q} a={item.a} />
          ))}
        </Section>

        {/* 2. Contact */}
        <Section title="Contact">
          <MenuRow
            icon="mail-outline"
            label="Email support"
            onPress={openEmail}
            last
          />
        </Section>

        {/* 3. Account & Subscription */}
        <Section title="Account & Subscription">
          <MenuRow
            icon="card-outline"
            label="Manage subscription"
            onPress={() => openUrl(SUBSCR_URL)}
          />
          <MenuRow
            icon="refresh-outline"
            label="Restore purchase"
            onPress={() => Alert.alert('Restore purchase', 'Go to Profile → Premium to restore your purchase.')}
          />
          <MenuRow
            icon="trash-outline"
            label="Delete account"
            onPress={confirmDeleteAccount}
            danger
            last
          />
        </Section>

        {/* 4. About */}
        <Section title="About">
          <MenuRow
            icon="shield-checkmark-outline"
            label="Privacy policy"
            onPress={() => openUrl(PRIVACY_URL)}
          />
          <MenuRow
            icon="document-text-outline"
            label="Terms of service"
            onPress={() => openUrl(TERMS_URL)}
          />
          <Pressable style={[mr.row]} disabled>
            <View style={mr.icon}>
              <Ionicons name="information-circle-outline" size={18} color={C.accent} />
            </View>
            <Text style={mr.label}>App version</Text>
            <Text style={s.versionBadge}>v{APP_VERSION}</Text>
          </Pressable>
        </Section>

        <View style={{ height: 16 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:         { flex: 1, backgroundColor: C.bg },
  scroll:       { paddingTop: 24 },

  header:       { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingTop: 8, paddingBottom: 20 },
  back:         { padding: 8 },
  title:        { fontSize: 24, fontWeight: '800', color: C.text, lineHeight: 30 },
  subtitle:     { fontSize: 14, color: C.sub, marginTop: 2 },

  versionBadge: { fontSize: 13, color: C.muted, fontWeight: '600' },
});
