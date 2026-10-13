// Full-screen list for choosing "your current plan".

import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { Plan } from '@/api';
import { colors, fonts, radius, space, TOUCH } from '@/theme';
import { Text } from './Text';

interface Props {
  visible: boolean;
  plans: Plan[];
  selectedId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}

export function PlanPicker({ visible, plans, selectedId, onSelect, onClose }: Props) {
  const [q, setQ] = useState('');
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? plans.filter((p) => `${p.retailer} ${p.name}`.toLowerCase().includes(needle)) : plans;
  }, [plans, q]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={s.wrap} edges={['top', 'bottom']}>
        <View style={s.head}>
          <Text variant="h2" style={{ flex: 1 }}>Your current plan</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={8} style={s.close}>
            <Ionicons name="close" size={24} color={colors.ink} />
          </Pressable>
        </View>
        <View style={s.search}>
          <Ionicons name="search" size={18} color={colors.inkMuted} />
          <TextInput value={q} onChangeText={setQ} placeholder="Search retailer or plan" placeholderTextColor={colors.inkMuted} style={s.input} accessibilityLabel="Search plans" />
        </View>
        <Text variant="caption" style={{ paddingHorizontal: space.xl }}>Not sure? Most homes are on SP Group’s regulated tariff.</Text>
        <FlatList
          data={shown}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ paddingTop: space.sm, paddingBottom: space.x3 }}
          renderItem={({ item }) => {
            const on = item.id === selectedId;
            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                onPress={() => { onSelect(item.id); onClose(); }}
                style={({ pressed }) => [s.row, on && s.rowOn, pressed && { opacity: 0.7 }]}
              >
                <View style={{ flex: 1 }}>
                  <Text variant="caption">{item.retailer}</Text>
                  <Text variant="bodyStrong">{item.name}</Text>
                  <Text variant="caption">{item.priceLabel} · {item.contractLabel}</Text>
                </View>
                {on ? <Ionicons name="checkmark-circle" size={22} color={colors.blue} /> : null}
              </Pressable>
            );
          }}
        />
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.canvas },
  head: { flexDirection: 'row', alignItems: 'center', padding: space.xl, paddingBottom: space.md },
  close: { width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: space.xl, marginBottom: space.sm, paddingHorizontal: space.lg, minHeight: TOUCH, borderRadius: radius.round, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  input: { flex: 1, fontFamily: fonts.regular, fontSize: 16, color: colors.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowOn: { backgroundColor: colors.blueSoft },
});
