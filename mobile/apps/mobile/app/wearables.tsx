/**
 * wearables.tsx — Wearable connections screen
 * Accessible depuis Profile → Wearables & Health
 */

import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView,
  ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getWearableStatus, type WearableSourceStatus } from '../lib/api';
import { connectOura, disconnectOura, syncOura } from '../lib/oura';
import { initAppleHealth, syncHealthKitToBackend } from '../lib/apple-health';
import { useTheme } from '../lib/theme-context';

// ─── Design tokens ────────────────────────────────────────────────────────────

const BG      = '#0B1220';
const SURFACE = '#1A2436';
const BORDER  = '#243046';
const TEXT    = '#E6EDF7';
const SUB     = '#9FB0C5';
const MUTED   = '#6B7F99';
const ACCENT  = '#33C8E8';
const GREEN   = '#4ADE80';
const ORANGE  = '#F97171';

// ─── Types ────────────────────────────────────────────────────────────────────

interface WearableConfig {
  id:          string;
  name:        string;
  icon:        string;
  color:       string;
  description: string;
  available:   boolean;       // false = coming soon
  comingSoon?: boolean;
}

const WEARABLES: WearableConfig[] = [
  {
    id:          'apple_health',
    name:        'Apple Health',
    icon:        'heart',
    color:       '#FF375F',
    description: 'Sleep, HRV, heart rate, activity from iPhone & Apple Watch',
    available:   true,
  },
  {
    id:          'oura',
    name:        'Oura Ring',
    icon:        'radio-outline',
    color:       '#3DDC97',
    description: 'Readiness score, HRV, sleep stages, body temperature',
    available:   true,
  },
  {
    id:          'whoop',
    name:        'Whoop',
    icon:        'pulse-outline',
    color:       '#F87171',
    description: 'Recovery score, strain, sleep performance',
    available:   false,
    comingSoon:  true,
  },
  {
    id:          'garmin',
    name:        'Garmin',
    icon:        'fitness-outline',
    color:       '#4DA3FF',
    description: 'Sleep, body battery, stress, training load',
    available:   false,
    comingSoon:  true,
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function WearablesScreen() {
  const router  = useRouter();
  const [status,  setStatus]  = useState<Record<string, WearableSourceStatus>>({});
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    const res = await getWearableStatus();
    if (res.ok && res.data) setStatus(res.data.sources);
    setLoading(false);
  }, []);

  useEffect(() => { void loadStatus(); }, [loadStatus]);

  // ── Apple Health ──────────────────────────────────────────────────────────

  async function handleAppleHealth() {
    setSyncing('apple_health');
    await initAppleHealth();
    await syncHealthKitToBackend(true);
    await loadStatus();
    setSyncing(null);
  }

  // ── Oura ─────────────────────────────────────────────────────────────────

  async function handleOuraConnect() {
    setSyncing('oura');
    const result = await connectOura();
    if (result === 'connected') {
      await loadStatus();
    } else if (result === 'error') {
      Alert.alert('Connection failed', 'Could not connect to Oura. Please try again.');
    }
    setSyncing(null);
  }

  async function handleOuraSync() {
    setSyncing('oura');
    await syncOura();
    await loadStatus();
    setSyncing(null);
  }

  async function handleOuraDisconnect() {
    Alert.alert(
      'Disconnect Oura',
      'R-Lo will no longer read your Oura data. Your past data will be kept.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            await disconnectOura();
            await loadStatus();
          },
        },
      ],
    );
  }

  // ── Render helpers ────────────────────────────────────────────────────────

  function renderCard(w: WearableConfig) {
    const src        = status[w.id];
    const connected  = src?.connected ?? false;
    const lastSync   = src?.lastSync;
    const isSyncing  = syncing === w.id;

    let lastSyncLabel = '';
    if (lastSync) {
      const diff = Date.now() - new Date(lastSync).getTime();
      const h    = Math.floor(diff / 3600000);
      if (h < 1)       lastSyncLabel = 'Synced just now';
      else if (h < 24) lastSyncLabel = `Synced ${h}h ago`;
      else             lastSyncLabel = `Synced ${Math.floor(h / 24)}d ago`;
    }

    return (
      <View key={w.id} style={s.card}>
        {/* Header */}
        <View style={s.cardHeader}>
          <View style={[s.iconWrap, { backgroundColor: `${w.color}18`, borderColor: `${w.color}30` }]}>
            <Ionicons name={w.icon as any} size={22} color={w.color} />
          </View>
          <View style={s.cardMeta}>
            <View style={s.nameRow}>
              <Text style={s.cardName}>{w.name}</Text>
              {w.comingSoon && (
                <View style={s.badge}>
                  <Text style={s.badgeText}>Soon</Text>
                </View>
              )}
              {connected && !w.comingSoon && (
                <View style={[s.badge, s.badgeConnected]}>
                  <Text style={[s.badgeText, { color: GREEN }]}>Connected</Text>
                </View>
              )}
            </View>
            <Text style={s.cardDesc} numberOfLines={2}>{w.description}</Text>
            {lastSyncLabel ? <Text style={s.lastSync}>{lastSyncLabel}</Text> : null}
          </View>
        </View>

        {/* Actions */}
        {!w.comingSoon && (
          <View style={s.cardActions}>
            {isSyncing ? (
              <ActivityIndicator size="small" color={ACCENT} />
            ) : connected ? (
              <>
                {w.id === 'oura' && (
                  <Pressable style={s.btnSecondary} onPress={handleOuraSync}>
                    <Ionicons name="sync-outline" size={14} color={ACCENT} />
                    <Text style={s.btnSecondaryText}>Sync now</Text>
                  </Pressable>
                )}
                {w.id === 'apple_health' && (
                  <Pressable style={s.btnSecondary} onPress={handleAppleHealth}>
                    <Ionicons name="sync-outline" size={14} color={ACCENT} />
                    <Text style={s.btnSecondaryText}>Sync now</Text>
                  </Pressable>
                )}
                {w.id === 'oura' && (
                  <Pressable style={s.btnDanger} onPress={handleOuraDisconnect}>
                    <Text style={s.btnDangerText}>Disconnect</Text>
                  </Pressable>
                )}
              </>
            ) : (
              <Pressable
                style={s.btnPrimary}
                onPress={w.id === 'oura' ? handleOuraConnect : handleAppleHealth}
              >
                <Ionicons name="link-outline" size={14} color="#0B1220" />
                <Text style={s.btnPrimaryText}>Connect</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={TEXT} />
        </Pressable>
        <Text style={s.title}>Wearables & Health</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.intro}>
          Connect your wearables so R-Lo can personalise your coaching with real sleep and recovery data.
        </Text>

        {loading ? (
          <ActivityIndicator color={ACCENT} style={{ marginTop: 40 }} />
        ) : (
          WEARABLES.map(renderCard)
        )}

        <Text style={s.disclaimer}>
          Your health data is stored securely and never shared. It is only used to personalise your coaching experience.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: BG },
  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn:      { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title:        { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600', color: TEXT },
  scroll:       { padding: 16, gap: 12, paddingBottom: 40 },
  intro:        { fontSize: 14, color: SUB, lineHeight: 20, marginBottom: 4 },
  card:         { backgroundColor: SURFACE, borderRadius: 16, padding: 16, gap: 12, borderWidth: 1, borderColor: BORDER },
  cardHeader:   { flexDirection: 'row', gap: 12 },
  iconWrap:     { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  cardMeta:     { flex: 1, gap: 3 },
  nameRow:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardName:     { fontSize: 15, fontWeight: '600', color: TEXT },
  cardDesc:     { fontSize: 13, color: MUTED, lineHeight: 18 },
  lastSync:     { fontSize: 11, color: ACCENT, marginTop: 2 },
  badge:        { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: `${MUTED}22` },
  badgeConnected: { backgroundColor: `${GREEN}18` },
  badgeText:    { fontSize: 11, fontWeight: '600', color: MUTED },
  cardActions:  { flexDirection: 'row', gap: 8, alignItems: 'center' },
  btnPrimary:   { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: ACCENT, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 },
  btnPrimaryText: { fontSize: 13, fontWeight: '600', color: '#0B1220' },
  btnSecondary: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: ACCENT, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  btnSecondaryText: { fontSize: 13, fontWeight: '500', color: ACCENT },
  btnDanger:    { borderWidth: 1, borderColor: ORANGE, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  btnDangerText: { fontSize: 13, fontWeight: '500', color: ORANGE },
  disclaimer:   { fontSize: 12, color: MUTED, textAlign: 'center', lineHeight: 18, marginTop: 8 },
});
