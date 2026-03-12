import { Pressable, View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';
import { useTheme } from '../../lib/theme-context';
import { spacing, radius, shadow } from '../../lib/design-tokens';

type Variant = 'default' | 'elevated' | 'outlined';

interface CardProps {
  children:  ReactNode;
  style?:    StyleProp<ViewStyle>;
  onPress?:  () => void;
  variant?:  Variant;
}

export function Card({ children, style, onPress, variant = 'default' }: CardProps) {
  const { theme } = useTheme();
  const c = theme.colors;

  const variantStyle: ViewStyle = {
    default:  {},
    elevated: shadow.md,
    outlined: { borderWidth: 1, borderColor: c.border },
  }[variant];

  const inner = (
    <View
      style={[
        s.base,
        {
          backgroundColor: c.surface,
          borderRadius:    radius.xl,
          padding:         spacing.lg,
        },
        variantStyle,
        style,
      ]}
    >
      {children}
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}>
        {inner}
      </Pressable>
    );
  }

  return inner;
}

const s = StyleSheet.create({
  base: {},
});
