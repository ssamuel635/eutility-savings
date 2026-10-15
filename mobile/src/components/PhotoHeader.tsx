// A tab screen's header: a local photo running edge to edge and under the
// status bar, fading into the white page, with the title sitting on the fade.
// Use with <Screen edges={[]}> so the photo can reach the top of the screen.

import { useCallback, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { space } from '@/theme';
import { FadedPhoto, type PhotoKey } from './Photo';
import { Text } from './Text';

interface Props {
  photo: PhotoKey;
  title: string;
  subtitle?: string;
  /** Sits over the top-right of the photo (e.g. the notifications bell). */
  corner?: ReactNode;
  /** Sits over the top-left of the photo (e.g. the logo). */
  badge?: ReactNode;
  ratio?: number;
  focus?: 'top' | 'center' | 'bottom';
  children?: ReactNode;
}

export function PhotoHeader({ photo, title, subtitle, corner, badge, ratio = 16 / 11, focus = 'center', children }: Props) {
  const insets = useSafeAreaInsets();
  // White status-bar text over the photo, dark again when the screen is left.
  useFocusEffect(useCallback(() => {
    setStatusBarStyle('light');
    return () => setStatusBarStyle('dark');
  }, []));

  return (
    <View style={s.bleed}>
      <FadedPhoto name={photo} ratio={ratio} focus={focus}>
        {/* A dark wash at the top keeps the clock and battery readable on any photo */}
        <LinearGradient pointerEvents="none" colors={['rgba(10,20,40,0.55)', 'rgba(10,20,40,0)']} style={[s.topWash, { height: insets.top + 72 }]} />
        {badge || corner ? (
          <View style={[s.topRow, { top: insets.top + space.sm }]}>
            <View>{badge}</View>
            <View>{corner}</View>
          </View>
        ) : null}
      </FadedPhoto>
      <View style={s.text}>
        <Text variant="display">{title}</Text>
        {subtitle ? <Text variant="body">{subtitle}</Text> : null}
        {children}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  // Undo the screen's padding so the photo runs edge to edge.
  bleed: { marginTop: -space.xl, marginHorizontal: -space.xl },
  topWash: { position: 'absolute', top: 0, left: 0, right: 0 },
  topRow: { position: 'absolute', left: space.xl, right: space.xl, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  // The title rides up onto the faded foot of the photo.
  text: { marginTop: -56, paddingHorizontal: space.xl, gap: space.sm },
});
