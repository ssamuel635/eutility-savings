import { Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { colors, fonts } from '@/theme';

type Variant = 'display' | 'h1' | 'h2' | 'h3' | 'body' | 'bodyStrong' | 'small' | 'caption' | 'eyebrow' | 'figure';

const styles: Record<Variant, TextStyle> = {
  display: { fontFamily: fonts.headSemi, fontSize: 30, lineHeight: 37, color: colors.heading, letterSpacing: -0.6 },
  h1: { fontFamily: fonts.headSemi, fontSize: 25, lineHeight: 32, color: colors.heading, letterSpacing: -0.4 },
  h2: { fontFamily: fonts.headSemi, fontSize: 20, lineHeight: 26, color: colors.heading, letterSpacing: -0.2 },
  h3: { fontFamily: fonts.headSemi, fontSize: 16, lineHeight: 22, color: colors.heading },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 25, color: colors.inkSoft },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 24, color: colors.ink },
  small: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.inkSoft },
  caption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.inkMuted },
  eyebrow: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18, color: colors.inkSoft },
  figure: { fontFamily: fonts.head, fontSize: 38, lineHeight: 44, color: colors.orangeDisplay, letterSpacing: -1 },
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
