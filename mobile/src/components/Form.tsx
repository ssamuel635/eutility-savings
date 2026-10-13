// Inputs: text fields, selectable chips, toggles.

import { forwardRef, useState } from 'react';
import { Pressable, StyleSheet, Switch, TextInput, View, type TextInputProps } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fonts, radius, space, TOUCH } from '@/theme';
import { Text } from './Text';

interface FieldProps extends TextInputProps {
  label: string;
  hint?: string;
  error?: string;
  prefix?: string;
}

export const Field = forwardRef<TextInput, FieldProps>(function Field({ label, hint, error, prefix, style, onFocus, onBlur, ...rest }, ref) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Text variant="small" color={colors.ink} style={{ fontFamily: fonts.medium }}>{label}</Text>
      <View style={[s.box, focused && s.focused, !!error && s.errored]}>
        {prefix ? <Text variant="body" color={colors.inkMuted}>{prefix}</Text> : null}
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          accessibilityHint={error || hint}
          placeholderTextColor={colors.inkMuted}
          style={[s.input, style]}
          onFocus={(e) => { setFocused(true); onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); onBlur?.(e); }}
          {...rest}
        />
      </View>
      {error ? (
        <Text variant="caption" color={colors.red} accessibilityLiveRegion="polite">{error}</Text>
      ) : hint ? (
        <Text variant="caption">{hint}</Text>
      ) : null}
    </View>
  );
});

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={[s.chip, selected && s.chipOn]}
      hitSlop={4}
    >
      {selected ? <Ionicons name="checkmark" size={15} color={colors.white} /> : null}
      <Text variant="small" color={selected ? colors.white : colors.ink} style={{ fontFamily: fonts.medium }}>{label}</Text>
    </Pressable>
  );
}

export function ChipGroup<T extends string>({ label, options, value, onChange }: { label?: string; options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={{ gap: 8 }} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {label ? <Text variant="small" color={colors.ink} style={{ fontFamily: fonts.medium }}>{label}</Text> : null}
      <View style={s.chips}>
        {options.map((o) => <Chip key={o.value} label={o.label} selected={o.value === value} onPress={() => onChange(o.value)} />)}
      </View>
    </View>
  );
}

export function Toggle({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={s.toggle}>
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">{label}</Text>
        {hint ? <Text variant="caption">{hint}</Text> : null}
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.blue, false: colors.border }}
        thumbColor={colors.white}
      />
    </View>
  );
}

const s = StyleSheet.create({
  box: {
    flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: TOUCH + 4,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: space.lg, backgroundColor: colors.white,
  },
  focused: { borderColor: colors.blue, backgroundColor: '#FCFDFE' },
  errored: { borderColor: colors.red },
  input: { flex: 1, fontFamily: fonts.regular, fontSize: 16, color: colors.ink, paddingVertical: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, paddingHorizontal: 14,
    borderRadius: radius.round, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white,
  },
  chipOn: { backgroundColor: colors.deep, borderColor: colors.deep },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: TOUCH + 8 },
});
