// Cards, pills, banners, list rows — the building blocks most screens use.

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fonts, radius, space, TOUCH, type TileTone } from '@/theme';
import { IconTile } from './Tiles';
import { Text } from './Text';

type Icon = keyof typeof Ionicons.glyphMap;

export function Card({ children, style, tone = 'white' }: { children: ReactNode; style?: StyleProp<ViewStyle>; tone?: 'white' | 'navy' | 'orange' | 'blue' }) {
  const bg = { white: colors.white, navy: colors.navy, orange: colors.orangeTint, blue: colors.blueTint }[tone];
  return <View style={[s.card, { backgroundColor: bg }, tone === 'white' && s.cardLine, style]}>{children}</View>;
}

// Tags: white, with a fine border and text in one of the logo's colours.
// Blue = good news/active, orange = needs a look or a highlight, navy = plain
// facts. Text colours pass 4.5:1 on white. (green/red/teal map onto these.)
const BRAND_PILL = {
  blue: { bg: colors.white, fg: colors.deep, bd: colors.blue },
  orange: { bg: colors.white, fg: colors.orangeAA, bd: colors.orange },
  navy: { bg: colors.white, fg: colors.navy, bd: colors.navy },
} as const;
const pillTones = { ...BRAND_PILL, green: BRAND_PILL.blue, red: BRAND_PILL.orange, teal: BRAND_PILL.navy } as const;

export function Pill({ label, tone = 'blue', icon }: { label: string; tone?: keyof typeof pillTones; icon?: Icon }) {
  const t = pillTones[tone];
  return (
    <View style={[s.pill, { backgroundColor: t.bg, borderColor: t.bd }]}>
      {icon ? <Ionicons name={icon} size={13} color={t.fg} /> : null}
      <Text variant="caption" color={t.fg} style={{ fontFamily: fonts.semibold }}>{label}</Text>
    </View>
  );
}

/** Labels made-up content, the same way the website's "Sample" tags do. */
export function PrototypeNote({ children }: { children: ReactNode }) {
  return (
    <View style={s.note} accessibilityRole="text">
      <Ionicons name="flask-outline" size={16} color={colors.orangeAA} />
      <Text variant="caption" color={colors.orangeAA} style={{ flex: 1 }}>{children}</Text>
    </View>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <View style={[s.note, { backgroundColor: colors.redTint }]} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Ionicons name="alert-circle-outline" size={16} color={colors.red} />
      <Text variant="small" color={colors.red} style={{ flex: 1 }}>{message}</Text>
    </View>
  );
}

export function ListRow({ icon, tone, label, value, onPress, last }: { icon?: Icon; tone?: TileTone; label: string; value?: string; onPress?: () => void; last?: boolean }) {
  const body = (
    <View style={[s.row, !last && s.rowBorder]}>
      {icon && tone ? <IconTile icon={icon} tone={tone} size={36} /> : icon ? <Ionicons name={icon} size={20} color={colors.blue} /> : null}
      <View style={{ flex: 1 }}>
        <Text variant={value ? 'caption' : 'bodyStrong'}>{label}</Text>
        {value ? <Text variant="bodyStrong" numberOfLines={2}>{value}</Text> : null}
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={18} color={colors.inkMuted} /> : null}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={value ? `${label}: ${value}` : label} onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.6 }}>
      {body}
    </Pressable>
  );
}

export function Stat({ value, label, tone = colors.ink }: { value: string; label: string; tone?: string }) {
  return (
    <View style={s.stat}>
      <Text variant="h2" color={tone} style={{ fontFamily: fonts.head }}>{value}</Text>
      <Text variant="caption">{label}</Text>
    </View>
  );
}

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <View style={{ gap: space.md }}>
      <View style={s.sectionHead}>
        <Text variant="h3">{title}</Text>
        {action}
      </View>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: radius.card, padding: space.xl, gap: space.md },
  cardLine: { borderWidth: 1, borderColor: colors.border },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 2, borderRadius: radius.round, borderWidth: 1 },
  note: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: colors.orangeTint, borderRadius: radius.sm, padding: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: TOUCH + 8, paddingVertical: space.sm },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  stat: { flex: 1, gap: 2 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
