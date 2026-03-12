import { Image, StyleSheet, type ImageStyle, type StyleProp } from 'react-native';

export type MascotEmotion =
  | 'celebration'
  | 'encourageant'
  | 'Enthousisate'
  | 'Fiere'
  | 'inquiet'
  | 'rassurante'
  | 'Reflexion';

type MascotSize = 'sm' | 'md' | 'lg' | 'xl';

interface MascotImageProps {
  emotion: MascotEmotion;
  size?:   MascotSize;
  style?:  StyleProp<ImageStyle>;
}

const sizeMap: Record<MascotSize, number> = {
  sm:  80,
  md:  120,
  lg:  180,
  xl:  240,
};

// Static require map — bundler resolves these at build time
const sourceMap: Record<MascotEmotion, ReturnType<typeof require>> = {
  celebration:  require('../../assets/mascot/celebration.png'),
  encourageant: require('../../assets/mascot/encourageant.png'),
  Enthousisate: require('../../assets/mascot/Enthousisate.png'),
  Fiere:        require('../../assets/mascot/Fiere.png'),
  inquiet:      require('../../assets/mascot/inquiet.png'),
  rassurante:   require('../../assets/mascot/rassurante.png'),
  Reflexion:    require('../../assets/mascot/Reflexion.png'),
};

export function MascotImage({ emotion, size = 'md', style }: MascotImageProps) {
  const px = sizeMap[size];
  return (
    <Image
      source={sourceMap[emotion]}
      style={[{ width: px, height: px }, s.img, style]}
      resizeMode="contain"
    />
  );
}

const s = StyleSheet.create({
  img: {},
});
