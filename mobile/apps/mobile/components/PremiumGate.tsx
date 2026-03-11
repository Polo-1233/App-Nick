/**
 * PremiumGate
 *
 * Modal shown when a premium-gated feature is triggered.
 * V1: client-side only. The "Get Premium" CTA is a placeholder (no IAP yet).
 *
 * Usage:
 *   <PremiumGate visible={showGate} featureName="Conflict Resolution" onClose={() => setShowGate(false)} />
 */

import { View, Text, Modal, Pressable, StyleSheet } from 'react-native';

interface Props {
  visible: boolean;
  featureName: string;
  onClose: () => void;
}

export function PremiumGate({ visible, featureName, onClose }: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.label}>PREMIUM</Text>
          <Text style={styles.title}>Airloop Premium</Text>
          <Text style={styles.description}>
            {featureName} requires Airloop Premium — advanced plan management for people who take recovery seriously.
          </Text>

          <View style={styles.featureList}>
            <Text style={styles.featureItem}>Unlimited conflict resolution</Text>
            <Text style={styles.featureItem}>Unlimited plan recalculation</Text>
            <Text style={styles.featureItem}>Post-event recovery protocols</Text>
          </View>

          {/* V1: CTA is a placeholder — no IAP implemented yet */}
          <Pressable style={styles.ctaBtn} onPress={onClose}>
            <Text style={styles.ctaBtnText}>Get Premium</Text>
          </Pressable>

          <Pressable style={styles.dismissBtn} onPress={onClose}>
            <Text style={styles.dismissBtnText}>Not now</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#111111',
    borderRadius: 20,
    padding: 28,
    width: '100%',
    borderWidth: 1,
    borderColor: '#1E3A5F',
  },
  label: {
    color: '#60A5FA',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 10,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 12,
  },
  description: {
    color: '#A3A3A3',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  featureList: {
    marginBottom: 24,
    gap: 8,
  },
  featureItem: {
    color: '#D4D4D4',
    fontSize: 14,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: '#60A5FA',
    paddingVertical: 2,
  },
  ctaBtn: {
    backgroundColor: '#1E3A5F',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#60A5FA',
    marginBottom: 12,
  },
  ctaBtnText: {
    color: '#60A5FA',
    fontSize: 16,
    fontWeight: '700',
  },
  dismissBtn: {
    padding: 12,
    alignItems: 'center',
  },
  dismissBtnText: {
    color: '#525252',
    fontSize: 14,
  },
});
