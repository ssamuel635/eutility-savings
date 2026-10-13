// The app's menu bar: a floating pill instead of the stock bottom bar. The
// active tab grows into a navy pill with its name; the rest are icons.

import { useEffect, useRef, type ComponentProps } from 'react';
import { Animated, Platform, Pressable, StyleSheet, View } from 'react-native';
import type { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { colors, fonts, radius } from '@/theme';
import { Text } from './Text';
import { useReducedMotion } from './Motion';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];
type Icon = keyof typeof Ionicons.glyphMap;

/** Route name → icon pair and label. */
export const TAB_ITEMS: Record<string, { label: string; icon: Icon; active: Icon }> = {
  index: { label: 'Home', icon: 'home-outline', active: 'home' },
  savings: { label: 'Savings', icon: 'flash-outline', active: 'flash' },
  application: { label: 'My switch', icon: 'swap-horizontal-outline', active: 'swap-horizontal' },
  rewards: { label: 'Rewards', icon: 'gift-outline', active: 'gift' },
  profile: { label: 'Account', icon: 'person-outline', active: 'person' },
};

/** The bar is docked (not floating), so screens need only their normal bottom padding. */
export const TAB_BAR_SPACE = 40;

export function TabBar({ state, navigation, insets }: TabBarProps) {
  return (
    <View style={[s.wrap, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={s.bar} accessibilityRole="tablist">
        {state.routes.map((route, i) => {
          const item = TAB_ITEMS[route.name];
          if (!item) return null;
          const focused = state.index === i;
          return (
            <TabButton
              key={route.key}
              item={item}
              focused={focused}
              onPress={() => {
                const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !e.defaultPrevented) {
                  Haptics.selectionAsync().catch(() => {});
                  navigation.navigate(route.name, route.params);
                }
              }}
            />
          );
        })}
      </View>
    </View>
  );
}

function TabButton({ item, focused, onPress }: { item: (typeof TAB_ITEMS)[string]; focused: boolean; onPress: () => void }) {
  const reduce = useReducedMotion();
  const t = useRef(new Animated.Value(focused ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(t, { toValue: focused ? 1 : 0, speed: 18, bounciness: 7, useNativeDriver: Platform.OS !== 'web' }).start();
  }, [focused, t]);

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={item.label}
      accessibilityState={{ selected: focused }}
      onPress={onPress}
      hitSlop={6}
      style={[s.item, focused && s.itemOn]}
    >
      {/* The navy pill fades and springs in behind the active tab */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, s.pill, reduce ? { opacity: focused ? 1 : 0 } : {
          opacity: t,
          transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }],
        }]}
      />
      <Ionicons name={focused ? item.active : item.icon} size={22} color={focused ? colors.white : colors.inkMuted} />
      {focused ? <Text variant="bodyStrong" color={colors.white} style={s.label} numberOfLines={1}>{item.label}</Text> : null}
    </Pressable>
  );
}

const s = StyleSheet.create({
  wrap: { backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: 10, paddingTop: 8 },
  bar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    height: 52,
  },
  item: { height: 48, minWidth: 48, borderRadius: radius.round, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  itemOn: { paddingHorizontal: 16 },
  pill: { borderRadius: radius.round, backgroundColor: colors.blue },
  label: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 18 },
});
