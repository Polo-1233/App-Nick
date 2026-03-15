/**
 * account.tsx — Account management screen
 *
 * Sections:
 *   1. Profile     — name + email
 *   2. Subscription— plan status + billing + actions
 *   3. Privacy     — data security link
 *   4. Actions     — log out + delete account
 */

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView }        from 'react-native-safe-area-context';
import { useRouter }           from 'expo-router';
import { Ionicons }            from '@expo/vector-icons';
import { useAuth }             from '../lib/auth-context';
import { usePremiumGate }      from '../lib/use-premium-gate';
import { loadOnboardingData }  from '../lib/storage';
import { restorePurchases }    from '../lib/purchases';
import { deleteAccount }       from '../lib/api';
import AsyncStorage            from '@react-native-async-storage/async-storage';

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  bg:      '#0B1220',
  card:    '#1A2436',
  surface2:'#243046',
  accent:  '#4DA3FF',
  success: '#3DDC97',
  warning: '#F5A623',
  danger:  '#F87171',
  text:    '#E6EDF7',
  sub:     '#9FB0C5',
  muted:   '#6B7F99',
  border:  'rgba(255,255,255,0.07)',
};

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
  wrap:  { marginBottom: 24, paddingHorizontal: 16 },
  title: { fontSize: 12, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10, marginLeft: 2 },
  card:  { backgroundColor: C.card, borderRadius: 18, overflow: 'hidden' },
});

// ─── Row ──────────────────────────────────────────────────────────────────────
function Row({
  icon, label, value, sub, onPress, danger, last, chevron = true,
}: {
  icon: string; label: string; value?: string; sub?: string;
  onPress?: () => void; danger?: boolean; last?: boolean; chevron?: boolean;
}) {
  const content = (
    <View style={[rw.row, !last && rw.border]}>
      <View style={[rw.iconWrap, danger && { backgroundColor: `${C.danger}15` }]}>
        <Ionicons name={icon as any} size={18} color={danger ? C.danger : C.accent} />
      </View>
      <View style={rw.text}>
        <Text style={[rw.label, danger && { color: C.danger }]}>{label}</Text>
        {sub ? <Text style={rw.sub}>{sub}</Text> : null}
      </View>
      {value ? <Text style={rw.value}>{value}</Text> : null}
      {onPress && chevron && <Ionicons name="chevron-forward" size={15} color={C.muted} />}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable style={({ pressed }) => [pressed && { opacity: 0.7 }]} onPress={onPress}>
      {content}
    </Pressable>
  );
}
const rw = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 16 },
  border:  { borderBottomWidth: 1, borderBottomColor: C.border },
  iconWrap:{ width: 36, height: 36, borderRadius: 10, backgroundColor: `${C.accent}15`, alignItems: 'center', justifyContent: 'center' },
  text:    { flex: 1 },
  label:   { fontSize: 15, color: C.text, fontWeight: '500' },
  sub:     { fontSize: 12, color: C.muted, marginTop: 2 },
  value:   { fontSize: 14, color: C.sub, marginRight: 6 },
});

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function AccountScreen() {
  const router                   = useRouter();
  const { session, logout }      = useAuth();
  const { isPremium }            = usePremiumGate();
  const [name,    setName]       = useState<string | null>(null);
  const [loading, setLoading]    = useState(false);

  const email = session?.user?.email ?? '—';

  useEffect(() => {
    loadOnboardingData().then(d => { if (d?.firstName) setName(d.firstName); });
  }, []);

  async function handleLogout() {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          try { await logout(); router.replace('/login'); }
          finally { setLoading(false); }
        },
      },
    ]);
  }

  async function handleRestore() {
    setLoading(true);
    try {
      const result = await restorePurchases();
      if (result.ok) Alert.alert('Restored', 'Your purchases have been restored.');
      else Alert.alert('Nothing to restore', 'No previous purchases found.');
    } catch {
      Alert.alert('Error', 'Could not restore purchases.');
    } finally {
      setLoading(false);
    }
  }

  function handleDeleteAccount() {
    Alert.alert(
      'Delete account',
      'This will permanently delete your account and all your data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete permanently',
          style: 'destructive',
          onPress: () => confirmDeleteAccount(),
        },
      ]
    );
  }

  async function confirmDeleteAccount() {
    setLoading(true);
    try {
      const result = await deleteAccount();
      if (!result.ok) {
        Alert.alert('Error', result.error ?? 'Could not delete account. Please try again.');
        return;
      }
      // Clear all local data before signing out
      await AsyncStorage.clear().catch(() => {});
      await logout();
      router.replace('/onboarding');
    } catch {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>

      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={s.back}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </Pressable>
        <View>
          <Text style={s.title}>Account</Text>
          <Text style={s.subtitle}>Manage your account and subscription</Text>
        </View>
      </View>

      {loading && (
        <View style={s.loadingBar}>
          <ActivityIndicator size="small" color={C.accent} />
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* 1. Profile */}
        <Section title="Profile">
          <Row
            icon="person-outline"
            label={name ?? 'R90 user'}
            sub={email}
            last
            chevron={false}
          />
        </Section>

        {/* 2. Subscription */}
        <Section title="Subscription">
          <Row
            icon="star-outline"
            label="Current plan"
            value={isPremium ? 'Premium' : 'Free'}
            sub={isPremium ? 'Full access active' : 'Limited features'}
            chevron={false}
          />
          <Row
            icon="rocket-outline"
            label="Upgrade to Premium"
            onPress={() => router.push('/subscription')}
          />
          <Row
            icon="card-outline"
            label="Manage subscription"
            onPress={() => router.push('/subscription')}
          />
          <Row
            icon="refresh-outline"
            label="Restore purchase"
            onPress={handleRestore}
            last
          />
        </Section>

        {/* 3. Privacy */}
        <Section title="Privacy">
          <Row
            icon="shield-checkmark-outline"
            label="Your data is secure"
            sub="Encrypted · Private · Never sold"
            onPress={() => router.push('/support')}
            last
          />
        </Section>

        {/* 4. Account actions */}
        <Section title="Account actions">
          <Row
            icon="log-out-outline"
            label="Log out"
            onPress={handleLogout}
          />
          <Row
            icon="trash-outline"
            label="Delete account"
            onPress={handleDeleteAccount}
            danger
            last
          />
        </Section>

        <View style={{ height: 16 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: C.bg },
  scroll:     { paddingTop: 24 },
  header:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingTop: 8, paddingBottom: 20 },
  back:       { padding: 8 },
  title:      { fontSize: 24, fontWeight: '800', color: C.text, lineHeight: 30 },
  subtitle:   { fontSize: 14, color: C.sub, marginTop: 2 },
  loadingBar: { alignItems: 'center', paddingBottom: 8 },
});
