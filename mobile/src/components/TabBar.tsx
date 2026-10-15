// The app's menu bar, in the style of Grab's: white, docked, an icon over a
// short label for every tab. The active tab turns Star Command Blue, its icon
// fills in and gives a small hop; everything else stays a quiet grey.

import { useEffect, useRef, type ComponentProps } from 'react';
import { Animated, Platform, Pressable, StyleSheet, View } from 'react-native';
import type { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { colors, fonts } from '@/theme';
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
  profile: { label: 'Account', icon: 'person-circle-outline', active: 'person-circle' },
};

/** The bar is docked (not floating), so screens need only their normal bottom padding. */
export const TAB_BAR_SPACE = 40;

export function TabBar({ state, navigation, insets }: TabBarProps) {
  return (
    <View style={[s.wrap, { paddingBottom: Math.max(insets.bottom, 6) }]} accessibilityRole="tablist">
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
  );
}

function TabButton({ item, focused, onPress }: { item: (typeof TAB_ITEMS)[string]; focused: boolean; onPress: () => void }) {
  const reduce = useReducedMotion();
  const hop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!focused || reduce) return;
    hop.setValue(0);
    Animated.spring(hop, { toValue: 1, speed: 14, bounciness: 12, useNativeDriver: Platform.OS !== 'web' }).start();
  }, [focused, reduce, hop]);

  const tint = focused ? colors.blue : colors.inkMuted;
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={item.label}
      accessibilityState={{ selected: focused }}
      onPress={onPress}
      style={s.item}
    >
      <Animated.View style={focused && !reduce ? { transform: [{ translateY: hop.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -3, 0] }) }] } : undefined}>
        <Ionicons name={focused ? item.active : item.icon} size={24} color={tint} />
      </Animated.View>
      <Text style={[s.label, { color: tint }, focused && s.labelOn]} numberOfLines={1}>{item.label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  wrap: { flexDirection: 'row', backgroundColor: colors.white, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 6 },
  item: { flex: 1, minHeight: 50, alignItems: 'center', justifyContent: 'center', gap: 3 },
  label: { fontFamily: fonts.medium, fontSize: 11, lineHeight: 14 },
  labelOn: { fontFamily: fonts.bold },
});
