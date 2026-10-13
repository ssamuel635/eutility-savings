// Monthly usage: a big live figure, a slider, and −/+ for exact steps
// (sliders alone are hard to set precisely, and for some people to use at all).

import { Pressable, StyleSheet, View } from 'react-native';
import Slider from '@react-native-community/slider';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { colors, fonts, radius, space } from '@/theme';
import { Text } from './Text';

interface Props {
  value: number;
  onChange: (kwh: number) => void;
  min: number;
  max: number;
  step?: number;
}

export function UsageSlider({ value, onChange, min, max, step = 10 }: Props) {
  const clamp = (v: number) => Math.max(min, Math.min(max, Math.round(v / step) * step));
  const nudge = (d: number) => { Haptics.selectionAsync().catch(() => {}); onChange(clamp(value + d)); };

  return (
    <View style={{ gap: space.sm }}>
      <Text variant="small" color={colors.ink} style={{ fontFamily: fonts.medium }}>Monthly usage</Text>
      <View style={s.readout}>
        <StepButton icon="remove" label="Less usage" onPress={() => nudge(-step)} disabled={value <= min} />
        <View style={s.figure} accessibilityLiveRegion="polite">
          <Text style={s.num}>{value.toLocaleString('en-SG')}</Text>
          <Text variant="bodyStrong" color={colors.inkMuted}>kWh/month</Text>
        </View>
        <StepButton icon="add" label="More usage" onPress={() => nudge(step)} disabled={value >= max} />
      </View>
      <Slider
        accessibilityLabel="Monthly usage in kWh"
        value={value}
        minimumValue={min}
        maximumValue={max}
        step={step}
        onValueChange={(v) => onChange(clamp(v))}
        minimumTrackTintColor={colors.blue}
        maximumTrackTintColor="#C9D8E8"
        thumbTintColor={colors.blue}
        style={s.slider}
      />
      <View style={s.scale}>
        <Text variant="caption">{min}</Text>
        <Text variant="caption">It’s on your SP bill under “Electricity”</Text>
        <Text variant="caption">{max.toLocaleString('en-SG')}</Text>
      </View>
    </View>
  );
}

function StepButton({ icon, label, onPress, disabled }: { icon: 'add' | 'remove'; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [s.step, pressed && { backgroundColor: '#C6DBF1' }, disabled && { opacity: 0.4 }]}
    >
      <Ionicons name={icon} size={22} color={colors.deep} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  readout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  figure: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  num: { fontFamily: fonts.bold, fontSize: 40, lineHeight: 46, color: colors.deep, letterSpacing: -0.8 },
  step: { width: 44, height: 44, borderRadius: radius.round, backgroundColor: colors.blueSoft, alignItems: 'center', justifyContent: 'center' },
  slider: { width: '100%', height: 44 },
  scale: { flexDirection: 'row', justifyContent: 'space-between', gap: space.sm },
});
