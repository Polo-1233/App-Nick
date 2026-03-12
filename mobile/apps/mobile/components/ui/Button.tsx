import { useRef } from 'react';
import {
  Animated,
  Pressable,
  ActivityIndicator,
  Text,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../lib/theme-context';
import { spacing, radius, fontSize, fontWeight } from '../../lib/design-tokens';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size    = 'sm' | 'md' | 'lg';

interface ButtonProps {
  label:     string;
  onPress:   () => void;
  variant?:  Variant;
  size?:     Size;
  loading?:  boolean;
  disabled?: boolean;
  icon?:     keyof typeof Ionicons.glyphMap;
  fullWidth?: boolean;
  style?:    StyleProp<ViewStyle>;
}

const sizeMap = {
  sm: { paddingVertical: spacing.sm,  paddingHorizontal: spacing.md,  textSize: fontSize.sm, iconSize: 14, gap: 4  },
  md: { paddingVertical: spacing.md,  paddingHorizontal: spacing.lg,  textSize: fontSize.md, iconSize: 16, gap: 6  },
  lg: { paddingVertical: spacing.lg,  paddingHorizontal: spacing.xl,  textSize: fontSize.lg, iconSize: 18, gap: 8  },
} as const;

export function Button({
  label,
  onPress,
  variant  = 'primary',
  size     = 'md',
  loading  = false,
  disabled = false,
  icon,
  fullWidth = false,
  style,
}: ButtonProps) {
  const { theme } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const c = theme.colors;

  const variantStyles: Record<Variant, { bg: string; text: string; borderColor?: string; borderWidth?: number }> = {
    primary:   { bg: c.accent,    text: '#000000' },
    secondary: { bg: c.surface2,  text: c.text,    borderColor: c.border, borderWidth: 1 },
    ghost:     { bg: 'transparent', text: c.accent },
    danger:    { bg: c.error,     text: '#FFFFFF' },
  };

  const vs = variantStyles[variant];
  const ss = sizeMap[size];
  const isDisabled = disabled || loading;

  function handlePressIn() {
    Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 40, bounciness: 0 }).start();
  }
  function handlePressOut() {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 4 }).start();
  }

  return (
    <Animated.View style={[{ transform: [{ scale }] }, fullWidth && s.fullWidth, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled}
        style={[
          s.base,
          {
            backgroundColor:  vs.bg,
            borderRadius:     radius.lg,
            paddingVertical:  ss.paddingVertical,
            paddingHorizontal: ss.paddingHorizontal,
            borderColor:      vs.borderColor,
            borderWidth:      vs.borderWidth ?? 0,
            opacity:          isDisabled ? 0.5 : 1,
          },
          fullWidth && s.fullWidth,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={vs.text} size="small" />
        ) : (
          <View style={[s.row, { gap: ss.gap }]}>
            {icon && (
              <Ionicons name={icon} size={ss.iconSize} color={vs.text} />
            )}
            <Text style={[s.label, { color: vs.text, fontSize: ss.textSize, fontWeight: fontWeight.semibold }]}>
              {label}
            </Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  base:      { alignItems: 'center', justifyContent: 'center' },
  fullWidth: { width: '100%' },
  row:       { flexDirection: 'row', alignItems: 'center' },
  label:     { includeFontPadding: false },
});
