import { useRef } from 'react';
import { ActivityIndicator, Animated, Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fonts, radius, TOUCH } from '@/theme';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'whatsapp' | 'ghost' | 'danger' | 'light';

// Filled, tinted pills — no hairline outlines (those read as stock Material).
const look: Record<Variant, { bg: string; fg: string; bd: string; pressed: string }> = {
  primary: { bg: colors.blue, fg: colors.white, bd: colors.blue, pressed: colors.deep },
  secondary: { bg: colors.blueSoft, fg: colors.deep, bd: colors.blueSoft, pressed: '#C6DBF1' },
  // WhatsApp green with navy text, like the website's WhatsApp buttons.
  whatsapp: { bg: colors.whatsapp, fg: colors.heading, bd: colors.whatsapp, pressed: colors.whatsappPressed },
  ghost: { bg: 'transparent', fg: colors.blue, bd: 'transparent', pressed: colors.blueSoft },
  danger: { bg: colors.redTint, fg: colors.red, bd: colors.redTint, pressed: '#F9D6D2' },
  light: { bg: colors.white, fg: colors.deep, bd: colors.white, pressed: colors.blueSoft },
};

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}

export function Button({ label, onPress, variant = 'primary', icon, loading, disabled, small, style, accessibilityHint }: ButtonProps) {
  const l = look[variant];
  const off = disabled || loading;
  const scale = useRef(new Animated.Value(1)).current;
  const springTo = (v: number) => Animated.spring(scale, { toValue: v, speed: 40, bounciness: 6, useNativeDriver: Platform.OS !== 'web' }).start();
  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      disabled={off}
      onPressIn={() => springTo(0.97)}
      onPressOut={() => springTo(1)}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress?.();
      }}
      style={({ pressed }) => [
        s.base,
        small && s.small,
        { backgroundColor: pressed ? l.pressed : l.bg, borderColor: l.bd },
        variant === 'primary' && !off && s.raised,
        off && s.off,
      ]}
    >
      <View style={s.row}>
        {loading ? (
          <ActivityIndicator color={l.fg} />
        ) : (
          <>
            {icon ? <Ionicons name={icon} size={small ? 16 : 19} color={l.fg} /> : null}
            <Text variant="bodyStrong" color={l.fg} style={[s.label, small && { fontSize: 14 }]}>{label}</Text>
          </>
        )}
      </View>
    </Pressable>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  base: { minHeight: TOUCH + 6, borderRadius: radius.round, borderWidth: 1, paddingHorizontal: 24, justifyContent: 'center' },
  small: { minHeight: 44, paddingHorizontal: 18 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  label: { fontFamily: fonts.head, letterSpacing: 0 },
  off: { opacity: 0.5 },
  raised: {},
});
