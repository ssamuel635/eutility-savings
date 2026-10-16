// Application progress: ✓ done · ● current · ○ upcoming.

import { StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { Stage } from '@/api';
import { shortDate } from '@/lib/format';
import { colors, space } from '@/theme';
import { Text } from './Text';

export function Timeline({ stages, compact }: { stages: Stage[]; compact?: boolean }) {
  return (
    <View accessibilityRole="list">
      {stages.map((st, i) => {
        const last = i === stages.length - 1;
        const when = st.state === 'done' && st.at ? shortDate(st.at) : st.state === 'current' ? 'In progress' : 'Coming up';
        return (
          <View
            key={st.key}
            style={s.row}
            accessible
            accessibilityLabel={`${st.label}. ${st.state === 'done' ? 'Done' : st.state === 'current' ? 'In progress' : 'Not started'}${st.at ? `, ${shortDate(st.at)}` : ''}`}
          >
            <View style={s.rail}>
              <Dot state={st.state} />
              {!last ? <View style={[s.line, st.state === 'done' && { backgroundColor: colors.blue }]} /> : null}
            </View>
            <View style={[s.body, last && { paddingBottom: 0 }]}>
              <Text variant="bodyStrong" color={st.state === 'upcoming' ? colors.inkMuted : colors.ink}>{st.label}</Text>
              <Text variant="caption" color={st.state === 'current' ? colors.blue : colors.inkMuted}>{when}</Text>
              {!compact && st.state !== 'upcoming' ? <Text variant="small" style={{ marginTop: 2 }}>{st.detail}</Text> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function Dot({ state }: { state: Stage['state'] }) {
  if (state === 'done') return <View style={[s.dot, { backgroundColor: colors.blue }]}><Ionicons name="checkmark" size={14} color={colors.white} /></View>;
  if (state === 'current') return <View style={[s.dot, s.current]}><View style={s.inner} /></View>;
  return <View style={[s.dot, s.upcoming]} />;
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.md },
  rail: { alignItems: 'center', width: 24 },
  dot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  current: { borderWidth: 2, borderColor: colors.blue, backgroundColor: colors.white },
  inner: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.blue },
  upcoming: { borderWidth: 2, borderColor: colors.border, backgroundColor: colors.white },
  line: { flex: 1, width: 2, backgroundColor: colors.border, marginVertical: 2 },
  body: { flex: 1, paddingBottom: space.xl },
});
