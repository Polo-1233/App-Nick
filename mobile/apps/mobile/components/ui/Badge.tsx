import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../lib/theme-context';
import { spacing, radius, fontSize, fontWeight } from '../../lib/design-tokens';

type BadgeColor = 'accent' | 'success' | 'warning' | 'error' | 'muted';
type BadgeSize  = 'sm' | 'md';

interface BadgeProps {
  label: string;
  color?: BadgeColor;
  size?:  BadgeSize;
}

export function Badge({ label, color = 'accent', size = 'md' }: BadgeProps) {
  const { theme } = useTheme();
  const c = theme.colors;

  const colorMap: Record<BadgeColor, string> = {
    accent:  c.accent,
    success: c.success,
    warning: c.warning,
    error:   c.error,
    muted:   c.textMuted,
  };

  const resolvedColor = colorMap[color];

  const sizeStyle = size === 'sm'
    ? { paddingHorizontal: spacing.sm, paddingVertical: 2, textSize: fontSize.xs }
    : { paddingHorizontal: spacing.md, paddingVertical: 4, textSize: fontSize.sm };

  return (
    <View
      style={[
        s.pill,
        {
          borderColor:      resolvedColor,
          borderRadius:     radius.full,
          paddingHorizontal: sizeStyle.paddingHorizontal,
          paddingVertical:  sizeStyle.paddingVertical,
          backgroundColor:  `${resolvedColor}18`,
        },
      ]}
    >
      <Text
        style={[
          s.label,
          { color: resolvedColor, fontSize: sizeStyle.textSize, fontWeight: fontWeight.semibold },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  pill:  { borderWidth: 1, alignSelf: 'flex-start' },
  label: { includeFontPadding: false },
});
