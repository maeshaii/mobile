import React from 'react';
import { Image } from 'expo-image';

type CachedImageProps = {
  uri?: string | null;
  style?: any;
  contentFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  transitionMs?: number;
  blurhash?: string;
};

const appendNgrokBypass = (input?: string | null): string | undefined => {
  if (!input) return undefined;
  try {
    // Only append for ngrok hosts and when parameter is not present yet
    const url = new URL(input);
    if (/ngrok/i.test(url.hostname) && !url.searchParams.has('ngrok-skip-browser-warning')) {
      url.searchParams.set('ngrok-skip-browser-warning', 'true');
      return url.toString();
    }
    return input;
  } catch {
    // If input is relative or invalid URL, don't modify
    return input || undefined;
  }
};

const CachedImage: React.FC<CachedImageProps> = ({
  uri,
  style,
  contentFit = 'cover',
  transitionMs = 150,
  blurhash
}) => {
  const [error, setError] = React.useState(false);
  const finalUri = appendNgrokBypass(uri ?? undefined);
  const source = finalUri ? { uri: finalUri, cache: 'force-cache' as const } : undefined;

  // Reset error state when URI changes
  React.useEffect(() => {
    setError(false);
  }, [uri]);

  if (error || !source) {
    // Return empty view if image failed to load
    return <Image source={undefined} style={style} contentFit={contentFit} />;
  }

  return (
    <Image
      source={source}
      style={style}
      contentFit={contentFit}
      transition={transitionMs}
      placeholder={blurhash}
      onError={() => {
        console.log('Image load error for URI:', finalUri);
        setError(true);
      }}
    />
  );
};

export default CachedImage;


