// A short burst of confetti for the moment a real saving is found — the same
// moment the website celebrates (CONFIG.confettiThreshold, S$100 a year).
// Brand colours only, once per result, about 1.8 seconds, and nothing at all
// when the phone asks for reduced motion. Built on Animated: no extra library.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { colors } from '@/theme';
import { useReducedMotion } from './Motion';

const PIECES = 36;
const PALETTE = [colors.blue, colors.navy, colors.orange, '#7CC4E8', '#FFB35C'];

export function Confetti({ run }: { run: boolean }) {
  const reduce = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const t = useRef(new Animated.Value(0)).current;
  const [done, setDone] = useState(false);

  // Each piece: where it starts, how far it drifts, how it spins, its size and colour.
  const pieces = useMemo(() => Array.from({ length: PIECES }, (_, i) => ({
    x: Math.random() * width,
    drift: (Math.random() - 0.5) * 140,
    fall: height * (0.55 + Math.random() * 0.4),
    delay: Math.random() * 0.25,
    spin: (Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 540),
    w: 6 + Math.random() * 5,
    h: 9 + Math.random() * 7,
    color: PALETTE[i % PALETTE.length],
  })), [width, height]);

  useEffect(() => {
    if (!run || reduce) return;
    t.setValue(0);
    setDone(false);
    const a = Animated.timing(t, { toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: Platform.OS !== 'web' });
    a.start(() => setDone(true));
    return () => a.stop();
  }, [run, reduce, t]);

  if (!run || reduce || done) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {pieces.map((p, i) => {
        const start = p.delay;
        const local = t.interpolate({ inputRange: [0, start, 1], outputRange: [0, 0, 1], extrapolate: 'clamp' });
        return (
          <Animated.View
            key={i}
            style={[s.piece, {
              left: p.x, width: p.w, height: p.h, backgroundColor: p.color,
              opacity: local.interpolate({ inputRange: [0, 0.05, 0.75, 1], outputRange: [0, 1, 1, 0] }),
              transform: [
                { translateY: local.interpolate({ inputRange: [0, 1], outputRange: [-20, p.fall] }) },
                { translateX: local.interpolate({ inputRange: [0, 1], outputRange: [0, p.drift] }) },
                { rotate: local.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.spin}deg`] }) },
              ],
            }]}
          />
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  piece: { position: 'absolute', top: 0, borderRadius: 1 },
});
