/**
 * Haptics — centralized, intentional feedback layer.
 *
 * Philosophy: rare, precise, premium — like a sports-watch confirmation.
 * Never loop, never fire on scroll/passive interactions.
 *
 * Usage:
 *   import { HapticsLight, HapticsSuccess } from '../utils/haptics';
 *   HapticsLight();   // confirms an important action
 *   HapticsSuccess(); // achievement / week complete
 */

import * as Haptics from 'expo-haptics';

/** Light impact — confirms an important user action (Next, Save, Upgrade CTA). */
export const HapticsLight = () =>
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

/** Medium impact — reserved for stronger confirmations if needed. */
export const HapticsMedium = () =>
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

/** Success notification — achievement moments (35 cycles, full week, badge). */
export const HapticsSuccess = () =>
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
