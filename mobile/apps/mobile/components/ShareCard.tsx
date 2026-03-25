/**
 * ShareCard — Generates shareable branded images for R90 milestones
 *
 * Usage:
 *   const shareRef = useRef<ShareCardHandle>(null);
 *   <ShareCard ref={shareRef} type="level-up" data={{ level: 'Attuned', color: '#1c9fda' }} />
 *   // Later:
 *   await shareRef.current?.share();
 *
 * Types:
 *   - level-up: "I'm now [Level] on R90"
 *   - milestone: "X days of R90 rhythm"
 *   - weekly: "This week: X% rhythm score"
 */

import { forwardRef, useImperativeHandle, useRef } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';

const BG     = '#0a0a3a';
const ACCENT = '#1c9fda';
const TEXT_W = '#FFFFFF';
const TEXT_M = '#A8C4E0';

export type ShareType = 'level-up' | 'milestone' | 'weekly';

export interface ShareData {
  level?:       string;
  levelColor?:  string;
  streak?:      number;
  rhythmScore?: number;
  totalCycles?: number;
  weekTarget?:  number;
}

export interface ShareCardHandle {
  share: () => Promise<void>;
}

export const ShareCard = forwardRef<ShareCardHandle, { type: ShareType; data: ShareData }>(
  function ShareCard({ type, data }, ref) {
    const viewShotRef = useRef<ViewShot>(null);

    useImperativeHandle(ref, () => ({
      share: async () => {
        try {
          const uri = await viewShotRef.current?.capture?.();
          if (!uri) return;

          const available = await Sharing.isAvailableAsync();
          if (!available) return;

          await Sharing.shareAsync(uri, {
            mimeType: 'image/png',
            dialogTitle: 'Share your R90 progress',
          });
        } catch {
          // Silent fail — sharing is best-effort
        }
      },
    }));

    const title =
      type === 'level-up'  ? `I'm now ${data.level}` :
      type === 'milestone' ? `${data.streak} days of rhythm` :
      type === 'weekly'    ? `${data.rhythmScore}% this week` :
      'R90 Navigator';

    const subtitle =
      type === 'level-up'  ? 'My rhythm is deepening' :
      type === 'milestone' ? 'Consistent rhythm, every day' :
      type === 'weekly'    ? `${data.totalCycles ?? 0} / ${data.weekTarget ?? 35} cycles` :
      '';

    const accentColor = data.levelColor ?? ACCENT;

    return (
      <ViewShot
        ref={viewShotRef}
        options={{ format: 'png', quality: 1 }}
        style={sc.hidden}
      >
        <View style={sc.card}>
          {/* Brand */}
          <Text style={sc.brand}>R90 NAVIGATOR</Text>

          {/* Main content */}
          <Text style={[sc.title, { color: accentColor }]}>{title}</Text>
          <Text style={sc.subtitle}>{subtitle}</Text>

          {/* Tagline */}
          <Text style={sc.tagline}>Sleep better. Live in rhythm.</Text>

          {/* Footer */}
          <View style={sc.footer}>
            <Text style={sc.footerText}>r90navigator.com</Text>
          </View>
        </View>
      </ViewShot>
    );
  }
);

const sc = StyleSheet.create({
  // Off-screen rendering (not visible to user)
  hidden: {
    position: 'absolute',
    left:     -9999,
    top:      -9999,
  },
  card: {
    width:           360,
    height:          640,
    backgroundColor: BG,
    padding:         32,
    justifyContent:  'center',
    alignItems:      'center',
    gap:             16,
  },
  brand: {
    fontSize:      12,
    fontWeight:    '800',
    color:         ACCENT,
    letterSpacing: 3,
    marginBottom:  24,
  },
  title: {
    fontSize:      36,
    fontWeight:    '800',
    textAlign:     'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize:   16,
    color:      TEXT_M,
    textAlign:  'center',
  },
  tagline: {
    fontSize:   13,
    color:      TEXT_M,
    fontStyle:  'italic',
    textAlign:  'center',
    marginTop:  32,
  },
  footer: {
    position: 'absolute',
    bottom:   32,
  },
  footerText: {
    fontSize:      11,
    color:         TEXT_M,
    letterSpacing: 0.5,
  },
});
