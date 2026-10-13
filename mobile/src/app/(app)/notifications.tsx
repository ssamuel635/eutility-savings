import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Card, LoadFailed, Loading, Screen, Text } from '@/components';
import { api } from '@/api';
import { useQuery } from '@/hooks/useQuery';
import { ago } from '@/lib/format';
import { colors, space } from '@/theme';

export default function Notifications() {
  const { data, error, loading, refresh } = useQuery(() => api.notifications.list());

  // Opening the list counts as reading it; the dots stay for this visit.
  useEffect(() => { if (data?.some((n) => !n.read)) api.notifications.markAllRead().catch(() => {}); }, [data]);

  if (loading) return <Screen edges={['bottom']}><Loading /></Screen>;
  if (error || !data) return <Screen edges={['bottom']}><LoadFailed onRetry={refresh} /></Screen>;

  return (
    <Screen edges={['bottom']}>
      {data.length === 0 ? (
        <Card><Text variant="small">No updates yet. We’ll let you know when anything changes.</Text></Card>
      ) : (
        <Card style={{ paddingVertical: space.sm }}>
          {data.map((n, i) => (
            <Pressable
              key={n.id}
              accessibilityRole={n.link ? 'button' : undefined}
              disabled={!n.link}
              onPress={() => n.link && router.navigate(n.link)}
              style={[s.row, i < data.length - 1 && s.border]}
            >
              <View style={[s.dot, !n.read && { backgroundColor: colors.orange }]} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="bodyStrong">{n.title}</Text>
                <Text variant="small">{n.body}</Text>
                <Text variant="caption">{ago(n.at)}</Text>
              </View>
            </Pressable>
          ))}
        </Card>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.md, paddingVertical: space.md },
  border: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 8, backgroundColor: 'transparent' },
});
