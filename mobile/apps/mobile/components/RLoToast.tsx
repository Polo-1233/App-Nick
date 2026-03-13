/**
 * RLoToast — petite notification in-app R-Lo style.
 *
 * Apparaît en haut de l'écran pendant 4 secondes puis disparaît.
 * R-Lo parle toujours à la première personne — jamais "system error".
 *
 * Usage:
 *   const { showToast } = useRLoToast();
 *   showToast("I noticed a small issue with your calendar. Tap to fix it.");
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';

const ROLO = require('../assets/mascot/rassurante.png');
const DURATION_MS = 4000;
const SLIDE_MS    = 300;

interface ToastState {
  message:  string;
  onPress?: () => void;
}

interface RLoToastRef {
  show: (msg: string, onPress?: () => void) => void;
}

// Global singleton ref so any component can trigger a toast
export const rloToastRef: { current: RLoToastRef | null } = { current: null };

export function showRLoToast(message: string, onPress?: () => void) {
  rloToastRef.current?.show(message, onPress);
}

export function RLoToastProvider() {
  const [toast,   setToast]   = useState<ToastState | null>(null);
  const slideAnim = useRef(new Animated.Value(-120)).current;
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue:         -120,
      duration:        SLIDE_MS,
      useNativeDriver: true,
    }).start(() => setToast(null));
  }, [slideAnim]);

  const show = useCallback((message: string, onPress?: () => void) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ message, onPress });
    slideAnim.setValue(-120);
    Animated.spring(slideAnim, {
      toValue:         0,
      useNativeDriver: true,
      tension:         80,
      friction:        10,
    }).start();
    timerRef.current = setTimeout(hide, DURATION_MS);
  }, [slideAnim, hide]);

  useEffect(() => {
    rloToastRef.current = { show };
    return () => { rloToastRef.current = null; };
  }, [show]);

  if (!toast) return null;

  return (
    <Animated.View style={[s.container, { transform: [{ translateY: slideAnim }] }]}>
      <Pressable
        style={s.inner}
        onPress={() => { toast.onPress?.(); hide(); }}
      >
        <View style={s.avatar}>
          <Image source={ROLO} style={s.mascot} resizeMode="contain" />
        </View>
        <Text style={s.message} numberOfLines={2}>{toast.message}</Text>
        <Pressable style={s.close} onPress={hide} hitSlop={8}>
          <Text style={s.closeText}>✕</Text>
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  container: {
    position:          'absolute',
    top:               0,
    left:              16,
    right:             16,
    zIndex:            9999,
    marginTop:         52,
  },
  inner: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   '#1A2436',
    borderRadius:      16,
    borderWidth:       1,
    borderColor:       'rgba(245,166,35,0.25)',
    padding:           12,
    gap:               10,
    shadowColor:       '#000',
    shadowOffset:      { width: 0, height: 4 },
    shadowOpacity:     0.3,
    shadowRadius:      8,
    elevation:         8,
  },
  avatar: {
    width:             36,
    height:            36,
    borderRadius:      18,
    backgroundColor:   'rgba(245,166,35,0.15)',
    alignItems:        'center',
    justifyContent:    'center',
    overflow:          'hidden',
  },
  mascot:  { width: 32, height: 32 },
  message: { flex: 1, color: '#E6EDF7', fontSize: 13, lineHeight: 18 },
  close:   { padding: 2 },
  closeText: { color: '#9FB0C5', fontSize: 12 },
});
