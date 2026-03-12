import { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet } from 'react-native';
import { useTheme } from '../../lib/theme-context';
import { radius } from '../../lib/design-tokens';

interface ProgressBarProps {
  value:     number;        // 0–1
  color?:    string;
  height?:   number;
  animated?: boolean;
}

export function ProgressBar({ value, color, height = 6, animated = true }: ProgressBarProps) {
  const { theme } = useTheme();
  const widthAnim = useRef(new Animated.Value(0)).current;

  const clampedValue = Math.min(1, Math.max(0, value));
  const resolvedColor = color ?? theme.colors.accent;

  useEffect(() => {
    if (animated) {
      Animated.timing(widthAnim, {
        toValue:         clampedValue,
        duration:        500,
        useNativeDriver: false,
      }).start();
    } else {
      widthAnim.setValue(clampedValue);
    }
  }, [clampedValue, animated, widthAnim]);

  const widthPercent = widthAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View
      style={[
        s.track,
        {
          height:          height,
          borderRadius:    radius.full,
          backgroundColor: `${resolvedColor}22`,
        },
      ]}
    >
      <Animated.View
        style={[
          s.fill,
          {
            width:        widthPercent,
            height:       height,
            borderRadius: radius.full,
            backgroundColor: resolvedColor,
          },
        ]}
      />
    </View>
  );
}

const s = StyleSheet.create({
  track: { overflow: 'hidden', width: '100%' },
  fill:  {},
});
