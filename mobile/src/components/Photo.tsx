// Photography, matching the website (assets/js/data/photos.js — same photos,
// same names, resized to 800px for phones). Free under the Unsplash License.

import { Image, StyleSheet, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/theme';

export const PHOTOS = {
  kites: { src: require('../../assets/photos/kites-marina-barrage.jpg'), alt: 'A family flying kites at Marina Barrage, with the city skyline behind them' },
  hdb: { src: require('../../assets/photos/hdb-estate.jpg'), alt: 'HDB blocks under a cloudy sky' },
  sofa: { src: require('../../assets/photos/father-daughter-sofa.jpg'), alt: 'A father and his daughter relaxing on the sofa at home' },
  livingRoom: { src: require('../../assets/photos/family-living-room.jpg'), alt: 'A family playing a board game together in their living room' },
  motherChild: { src: require('../../assets/photos/mother-child-sofa.jpg'), alt: 'A mother and her daughter laughing together on the sofa' },
  dinner: { src: require('../../assets/photos/family-dinner.jpg'), alt: 'A family having dinner together at home' },
  neighbours: { src: require('../../assets/photos/neighbours-outdoors.jpg'), alt: 'Two friends chatting outdoors in the neighbourhood' },
  voidDeck: { src: require('../../assets/photos/void-deck-chess.jpg'), alt: 'Neighbours playing a game of chess outside' },
} satisfies Record<string, { src: ImageSourcePropType; alt: string }>;

export type PhotoKey = keyof typeof PHOTOS;

interface Props {
  name: PhotoKey;
  /** Width / height. */
  ratio?: number;
  /** Fade the bottom of the photo into this colour (white by default); null for no fade. */
  fadeTo?: string | null;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  focus?: 'top' | 'center' | 'bottom';
}

/** A photo with an optional soft fade at the bottom, like the website's. */
export function FadedPhoto({ name, ratio = 3 / 2, fadeTo = colors.white, style, children, focus = 'center' }: Props) {
  const p = PHOTOS[name];
  return (
    <View style={[s.frame, { aspectRatio: ratio }, style]}>
      <Image source={p.src} style={[StyleSheet.absoluteFill, s.img, focus === 'top' && { top: 0 }, focus === 'bottom' && s.bottom]} resizeMode="cover" accessibilityLabel={p.alt} accessible />
      {fadeTo ? (
        <LinearGradient
          pointerEvents="none"
          colors={[withAlpha(fadeTo, 0), withAlpha(fadeTo, 0.7), fadeTo]}
          locations={[0.45, 0.82, 1]}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {children}
    </View>
  );
}

/** '#RRGGBB' + alpha → rgba(). */
function withAlpha(hex: string, a: number) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

const s = StyleSheet.create({
  // Stretch rather than width:100%, so negative margins can bleed it to the screen edge.
  frame: { alignSelf: 'stretch', overflow: 'hidden', backgroundColor: '#E6EDF3' },
  img: { width: '100%', height: '100%' },
  bottom: { top: undefined, bottom: 0 },
});
