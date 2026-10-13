// Motion, matching the website's feel: content settles in, numbers count up,
// bars fill, the success tick pops. Everything is skipped when the phone's
// "reduce motion" setting is on.

import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from './Text';

const native = Platform.OS !== 'web';
const easeOut = Easing.out(Easing.cubic);

export function useReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduce, () => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => sub.remove();
  }, []);
  return reduce;
}

/** Fades up into place once, when it first appears. */
export function FadeIn({ children, delay = 0, style }: { children: ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const reduce = useReducedMotion();
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(t, { toValue: 1, duration: 480, delay, easing: easeOut, useNativeDriver: native }).start();
  }, [t, delay]);
  if (reduce) return <Animated.View style={style}>{children}</Animated.View>;
  return (
    <Animated.View
      style={[style, {
        opacity: t,
        transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
      }]}
    >
      {children}
    </Animated.View>
  );
}

/** Scales in with a little spring — for a moment worth marking (bill sent). */
export function PopIn({ children, delay = 120 }: { children: ReactNode; delay?: number }) {
  const reduce = useReducedMotion();
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(t, { toValue: 1, delay, friction: 5, tension: 90, useNativeDriver: native }).start();
  }, [t, delay]);
  if (reduce) return <>{children}</>;
  return <Animated.View style={{ opacity: t, transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }] }}>{children}</Animated.View>;
}

/** A number that counts up to its value (the savings reveal). */
export function CountUp({ value, format, duration = 1200, ...textProps }: {
  value: number;
  format: (n: number) => string;
  duration?: number;
} & Omit<ComponentProps<typeof Text>, 'children'>) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? value : 0);
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) { setShown(value); return; }
    t.setValue(0);
    const id = t.addListener(({ value: v }) => setShown(v));
    Animated.timing(t, { toValue: value, duration, easing: easeOut, useNativeDriver: false }).start(() => setShown(value));
    return () => t.removeListener(id);
  }, [value, duration, reduce, t]);
  return <Text accessibilityLabel={format(value)} {...textProps}>{format(shown)}</Text>;
}

/** A progress bar whose fill grows to its value. */
export function ProgressBar({ value, trackStyle, fillStyle }: { value: number; trackStyle: StyleProp<ViewStyle>; fillStyle: StyleProp<ViewStyle> }) {
  const reduce = useReducedMotion();
  const t = useRef(new Animated.Value(0)).current;
  const pct = Math.max(0, Math.min(1, value));
  useEffect(() => {
    Animated.timing(t, { toValue: pct, duration: reduce ? 0 : 900, delay: reduce ? 0 : 250, easing: easeOut, useNativeDriver: false }).start();
  }, [t, pct, reduce]);
  return (
    <Animated.View style={trackStyle}>
      <Animated.View style={[fillStyle, { width: t.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
    </Animated.View>
  );
}
