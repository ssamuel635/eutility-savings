import { Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { colors, fonts } from '@/theme';

type Variant = 'display' | 'h1' | 'h2' | 'h3' | 'body' | 'bodyStrong' | 'small' | 'caption' | 'eyebrow' | 'figure';

const styles: Record<Variant, TextStyle> = {
  display: { fontFamily: fonts.serif, fontSize: 34, lineHeight: 40, color: colors.ink, letterSpacing: -0.4 },
  h1: { fontFamily: fonts.serif, fontSize: 28, lineHeight: 34, color: colors.ink, letterSpacing: -0.3 },
  h2: { fontFamily: fonts.serif, fontSize: 22, lineHeight: 28, color: colors.ink },
  h3: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 23, color: colors.ink },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: colors.inkSoft },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 24, color: colors.ink },
  small: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.inkSoft },
  caption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.inkMuted },
  eyebrow: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18, color: colors.inkSoft },
  figure: { fontFamily: fonts.bold, fontSize: 40, lineHeight: 46, color: colors.orangeDisplay, letterSpacing: -0.8 },
};

export function Text({ variant = 'body', color, center, style, ...rest }: TextProps & { variant?: Variant; color?: string; center?: boolean }) {
  const role = variant === 'display' || variant === 'h1' || variant === 'h2' ? 'header' : undefined;
  return (
    <RNText
      accessibilityRole={role}
      maxFontSizeMultiplier={1.6}
      style={[styles[variant], color ? { color } : null, center ? { textAlign: 'center' } : null, style]}
      {...rest}
    />
  );
}
