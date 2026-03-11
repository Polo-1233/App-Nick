/**
 * SubscriptionCard — compact plan card for the Profile screen.
 *
 * Two states: free (shows "Upgrade ›" CTA) and premium (shows "Manage").
 * Sits next to PerformanceCard in the profile horizontal pair.
 */

import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { SubscriptionState } from '../lib/subscription';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  subscription: SubscriptionState;
  onPress?:     () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SubscriptionCard({ subscription, onPress }: Props) {
  const isPremium = subscription.plan === 'premium';

  return (
    <Pressable style={s.card} onPress={onPress}>
      {/* Decorative glow circle */}
      <View style={[s.glowCircle, isPremium && s.glowCirclePremium]} />

      <Text style={s.label}>PLAN</Text>

      <Text style={[s.planName, isPremium && s.planNamePremium]}>
        {isPremium ? 'Premium' : 'Free'}
      </Text>

      <Text style={s.subText}>
        {isPremium ? 'Full access' : 'Basic tracking'}
      </Text>

      {/* Trial end date — shown only when in trial */}
      {subscription.trialEndsAt && (
        <Text style={s.trialText}>
          Trial ends {fmtDate(subscription.trialEndsAt)}
        </Text>
      )}

      <View style={s.spacer} />

      {/* CTA */}
      <View style={[s.ctaBtn, isPremium && s.ctaBtnManage]}>
        <Text style={[s.ctaTxt, isPremium && s.ctaTxtManage]}>
          {isPremium ? 'Manage' : 'Upgrade ›'}
        </Text>
      </View>
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const GREEN = '#22C55E';

const s = StyleSheet.create({
  card: {
    flex:            1,
    backgroundColor: '#0D1117',
    borderRadius:    18,
    padding:         16,
    borderWidth:     1,
    borderColor:     '#1E2A1E',
    overflow:        'hidden',
    minHeight:       160,
    justifyContent:  'flex-start',
  },
  glowCircle: {
    position:        'absolute',
    top:             -30,
    right:           -30,
    width:           100,
    height:          100,
    borderRadius:    50,
    backgroundColor: GREEN,
    opacity:         0.07,
  },
  glowCirclePremium: {
    opacity: 0.14,
  },
  label: {
    color:         '#3A3A3A',
    fontSize:      9,
    fontWeight:    '700',
    letterSpacing: 1.6,
    marginBottom:  14,
  },
  planName: {
    color:         '#FFFFFF',
    fontSize:      22,
    fontWeight:    '700',
    letterSpacing: -0.5,
  },
  planNamePremium: {
    color: GREEN,
  },
  subText: {
    color:     '#3A3A3A',
    fontSize:  11,
    marginTop: 3,
  },
  trialText: {
    color:     '#EAB308',
    fontSize:  10,
    marginTop: 6,
    fontWeight:'500',
  },
  spacer: {
    flex:      1,
    minHeight: 12,
  },
  ctaBtn: {
    backgroundColor: '#052E16',
    borderRadius:    10,
    paddingVertical: 8,
    alignItems:      'center',
    borderWidth:     1,
    borderColor:     '#166534',
    marginTop:       12,
  },
  ctaBtnManage: {
    backgroundColor: '#111111',
    borderColor:     '#2A2A2A',
  },
  ctaTxt: {
    color:      GREEN,
    fontSize:   12,
    fontWeight: '600',
  },
  ctaTxtManage: {
    color: '#525252',
  },
});
