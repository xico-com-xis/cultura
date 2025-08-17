import { cacheImage, getCachedImageUri } from '@/utils/imageCache';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ImageProps, StyleSheet, View } from 'react-native';

interface CachedImageProps extends Omit<ImageProps, 'source'> {
  source: { uri: string } | { uri?: string };
  showLoader?: boolean;
  loaderColor?: string;
}

export const CachedImage: React.FC<CachedImageProps> = ({ 
  source, 
  style, 
  showLoader = true,
  loaderColor = '#4C8BF5',
  ...props 
}) => {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const loadImage = async () => {
      if (!source?.uri) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setHasError(false);

        // First, try to get cached version
        const cachedUri = await getCachedImageUri(source.uri);
        
        if (cachedUri !== source.uri) {
          // Image is cached, use it immediately
          setImageUri(cachedUri);
          setIsLoading(false);
        } else {
          // Image not cached, show original URL while caching in background
          setImageUri(source.uri);
          
          // Cache the image in background for next time
          cacheImage(source.uri).catch(error => {
            console.warn('Background caching failed:', error);
          });
        }
      } catch (error) {
        console.error('Error loading cached image:', error);
        setImageUri(source.uri);
        setHasError(true);
      } finally {
        setIsLoading(false);
      }
    };

    loadImage();
  }, [source?.uri]);

  const handleImageLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const handleImageError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  if (!source?.uri) {
    return null;
  }

  return (
    <View style={[styles.container, style]}>
      {imageUri && (
        <Image
          {...props}
          source={{ uri: imageUri }}
          style={[styles.image, style]}
          onLoad={handleImageLoad}
          onError={handleImageError}
        />
      )}
      
      {isLoading && showLoader && (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="small" color={loaderColor} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  loaderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(240, 240, 240, 0.8)',
  },
});
