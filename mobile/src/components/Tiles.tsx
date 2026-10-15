// Coloured icon tiles and the quick-action grid (the Grab-style row of
// shortcuts on Home). One colour per kind of task, so people learn them.

import { Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { colors, fonts, tiles, type TileTone } from '@/theme';
import { Text } from './Text';

type Icon = keyof typeof Ionicons.glyphMap;

export function IconTile({ icon, tone = 'blue', size = 40 }: { icon: Icon; tone?: TileTone; size?: number }) {
  const t = tiles[tone];
  return (
    <View style={[s.tile, { width: size, height: size, borderRadius: Math.round(size * 0.3), backgroundColor: t.bg, borderColor: t.border }]}>
      <Ionicons name={icon} size={Math.round(size * 0.52)} color={t.fg} />
    </View>
  );
}

export interface QuickAction { icon: Icon; label: string; tone: TileTone; onPress: () => void; badge?: string }

/** A row of big tiles with their names underneath (four to a row by default). */
export function QuickActions({ items, columns = 4 }: { items: QuickAction[]; columns?: number }) {
  return (
    <View style={s.grid}>
      {items.map((a) => (
        <Pressable
          key={a.label}
          accessibilityRole="button"
          accessibilityLabel={a.badge ? `${a.label}, ${a.badge}` : a.label}
          onPress={() => { Haptics.selectionAsync().catch(() => {}); a.onPress(); }}
          style={({ pressed }) => [s.action, { width: `${100 / columns}%` }, pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] }]}
        >
          <View>
            <IconTile icon={a.icon} tone={a.tone} size={56} />
            {a.badge ? <View style={s.badge}><Text style={s.badgeText}>{a.badge}</Text></View> : null}
          </View>
          <Text style={s.label} numberOfLines={2}>{a.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  tile: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 18 },
  action: { alignItems: 'center', gap: 8 },
  label: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 17, color: colors.ink, textAlign: 'center', paddingHorizontal: 2 },
  badge: { position: 'absolute', top: -6, right: -10, backgroundColor: colors.orange, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1, borderWidth: 2, borderColor: colors.white },
  badgeText: { fontFamily: fonts.bold, fontSize: 10, lineHeight: 14, color: colors.white },
});
