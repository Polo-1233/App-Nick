/**
 * CRP Card Component
 *
 * Shows Controlled Recovery Period card when zone is yellow/orange.
 * User can mark CRP as completed (30 min or 90 min).
 */

import { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import type { ReadinessZone } from '@r90/types';
import { saveCRPRecord } from '../lib/storage';
import type { CRPRecord } from '../lib/storage';

interface Props {
  zone: ReadinessZone;
  onComplete?: () => void;
}

export function CRPCard({ zone, onComplete }: Props) {
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(false);

  // Only show CRP card for yellow/orange zones
  if (zone === 'green') {
    return null;
  }

  const duration = zone === 'orange' ? 90 : 30;

  const handleMarkCompleted = async () => {
    setSaving(true);
    try {
      const record: CRPRecord = {
        date: new Date().toISOString().split('T')[0],
        timestamp: Date.now(),
        duration,
      };

      await saveCRPRecord(record);
      setCompleted(true);

      // Notify parent (optional)
      if (onComplete) {
        onComplete();
      }
    } catch (error) {
      console.error('Failed to save CRP record:', error);
    } finally {
      setSaving(false);
    }
  };

  if (completed) {
    return (
      <View style={styles.container}>
        <View style={styles.completedCard}>
          <Text style={styles.completedIcon}>✓</Text>
          <Text style={styles.completedText}>
            CRP completed ({duration} min)
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.card, zone === 'orange' && styles.cardOrange]}>
        <Text style={styles.label}>Controlled Recovery Period</Text>
        <Text style={styles.title}>Take a {duration}-minute CRP</Text>
        <Text style={styles.description}>
          {zone === 'orange'
            ? 'Your recent sleep average is low. A 90-minute recovery period will help restore your readiness.'
            : 'Your sleep has been slightly below target. A 30-minute recovery period can help.'}
        </Text>

        <Pressable
          style={[styles.button, saving && styles.buttonDisabled]}
          onPress={handleMarkCompleted}
          disabled={saving}
        >
          <Text style={styles.buttonText}>
            {saving ? 'Saving...' : 'Mark Completed'}
          </Text>
        </Pressable>

        <Text style={styles.hint}>
          Best time: 13:00–15:00 (midday) or 17:00–19:00 (evening)
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#422006',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EAB308',
  },
  cardOrange: {
    backgroundColor: '#431407',
    borderColor: '#F97316',
  },
  label: {
    fontSize: 12,
    color: '#A3A3A3',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    color: '#D4D4D4',
    lineHeight: 20,
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#EAB308',
    padding: 14,
    borderRadius: 10,
    marginBottom: 12,
  },
  buttonDisabled: {
    backgroundColor: '#854D0E',
  },
  buttonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  hint: {
    fontSize: 12,
    color: '#A3A3A3',
    textAlign: 'center',
  },
  completedCard: {
    backgroundColor: '#052E16',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#22C55E',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  completedIcon: {
    fontSize: 20,
    color: '#22C55E',
  },
  completedText: {
    fontSize: 16,
    color: '#22C55E',
    fontWeight: '600',
  },
});
