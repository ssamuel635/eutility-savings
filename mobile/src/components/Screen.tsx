import { Children, type ReactNode } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { colors, space } from '@/theme';
import { Text } from './Text';
import { Button } from './Button';
import { FadeIn } from './Motion';
import { TAB_BAR_SPACE } from './TabBar';

interface ScreenProps {
  children: ReactNode;
  /** Pinned below the scroll area (primary action). */
  footer?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  edges?: Edge[];
  background?: string;
  /** A tab screen: leaves room at the bottom for the floating menu bar. */
  tabs?: boolean;
}

/** Scrollable page with safe-area padding, keyboard handling and optional pull-to-refresh. */
export function Screen({ children, footer, refreshing, onRefresh, edges = ['top'], background = colors.canvas, tabs }: ScreenProps) {
  return (
    <SafeAreaView edges={edges} style={[s.flex, { backgroundColor: background }]}>
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[s.content, tabs && { paddingBottom: TAB_BAR_SPACE }]}
          keyboardShouldPersistTaps="handled"
          refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.blue} /> : undefined}
        >
          {Children.toArray(children).map((child, i) => (
            <FadeIn key={(child as { key?: string }).key ?? i} delay={40 + Math.min(i, 6) * 60}>{child}</FadeIn>
          ))}
        </ScrollView>
        {footer ? <View style={s.footer}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={s.center} accessibilityLiveRegion="polite">
      <ActivityIndicator color={colors.blue} size="large" />
      <Text variant="caption">{label}</Text>
    </View>
  );
}

export function LoadFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={s.center}>
      <Text variant="h3">Couldn’t load this</Text>
      <Text variant="small" center>Check your connection and try again.</Text>
      <Button label="Try again" variant="secondary" small onPress={onRetry} />
    </View>
  );
}

export function Logo({ height = 36 }: { height?: number }) {
  return (
    <Image
      source={require('../../assets/eutility-logo.png')}
      style={{ height, width: height * (314 / 112) }}
      resizeMode="contain"
      accessibilityLabel="Eutility — get control"
    />
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: space.xl, paddingBottom: space.x4, gap: space.xl },
  footer: { paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: space.lg, gap: space.sm, backgroundColor: colors.white, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.x3, minHeight: 240 },
});
