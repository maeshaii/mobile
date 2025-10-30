import React from 'react';
import { Image } from 'expo-image';

type CachedImageProps = {
  uri?: string | null;
  style?: any;
  contentFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  transitionMs?: number;
  blurhash?: string;
};

const CachedImage: React.FC<CachedImageProps> = ({
  uri,
  style,
  contentFit = 'cover',
  transitionMs = 150,
  blurhash
}) => {
  const source = uri ? { uri, cache: 'force-cache' as const } : undefined;

  return (
    <Image
      source={source}
      style={style}
      contentFit={contentFit}
      transition={transitionMs}
      placeholder={blurhash}
    />
  );
};

export default CachedImage;


