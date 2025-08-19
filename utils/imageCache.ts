import * as FileSystem from 'expo-file-system';

const IMAGE_CACHE_DIR = `${FileSystem.cacheDirectory}images/`;
const MAX_CACHE_SIZE = 100 * 1024 * 1024; // 100MB max cache size
const MAX_CACHE_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days max age

// Ensure the cache directory exists
const ensureCacheDirectory = async () => {
  const dirInfo = await FileSystem.getInfoAsync(IMAGE_CACHE_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(IMAGE_CACHE_DIR, { intermediates: true });
  }
};

// Generate a unique cache key from URL
const getCacheKey = (url: string): string => {
  // Create a simple hash from the URL
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Convert to positive number and add timestamp for uniqueness
  const hashStr = Math.abs(hash).toString(36);
  
  // Also include the last part of the URL for better uniqueness
  const urlParts = url.split('/');
  const filename = urlParts[urlParts.length - 1] || '';
  const cleanFilename = filename.replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 30);
  
  return `${hashStr}_${cleanFilename}`;
};

// Get the cached file path for a URL
const getCachedFilePath = (url: string): string => {
  const cacheKey = getCacheKey(url);
  // Extract file extension from URL or default to jpg
  const extension = url.split('.').pop()?.split('?')[0] || 'jpg';
  return `${IMAGE_CACHE_DIR}${cacheKey}.${extension}`;
};

// Get cache size
export const getCacheSize = async (): Promise<number> => {
  try {
    const dirInfo = await FileSystem.getInfoAsync(IMAGE_CACHE_DIR);
    if (!dirInfo.exists) return 0;
    
    const files = await FileSystem.readDirectoryAsync(IMAGE_CACHE_DIR);
    let totalSize = 0;
    
    for (const file of files) {
      const filePath = `${IMAGE_CACHE_DIR}${file}`;
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (fileInfo.exists && !fileInfo.isDirectory) {
        totalSize += (fileInfo as any).size || 0;
      }
    }
    
    return totalSize;
  } catch (error) {
    console.error('Error getting cache size:', error);
    return 0;
  }
};

// Clean cache if it exceeds size limit (like Instagram/Twitter do)
const cleanCacheIfNeeded = async (): Promise<void> => {
  try {
    const cacheSize = await getCacheSize();
    
    if (cacheSize > MAX_CACHE_SIZE) {
      console.log(`Cache size ${(cacheSize / 1024 / 1024).toFixed(1)}MB exceeds limit, cleaning...`);
      
      // Get all cached files with their modification times
      const files = await FileSystem.readDirectoryAsync(IMAGE_CACHE_DIR);
      const fileInfos: Array<{ path: string; modificationTime: number; size: number }> = [];
      
      for (const file of files) {
        const filePath = `${IMAGE_CACHE_DIR}${file}`;
        const info = await FileSystem.getInfoAsync(filePath);
        if (info.exists && !info.isDirectory) {
          fileInfos.push({
            path: filePath,
            modificationTime: (info as any).modificationTime || 0,
            size: (info as any).size || 0
          });
        }
      }
      
      // Sort by modification time (oldest first)
      fileInfos.sort((a, b) => a.modificationTime - b.modificationTime);
      
      // Delete oldest files until we're under the limit
      let currentSize = cacheSize;
      for (const fileInfo of fileInfos) {
        if (currentSize <= MAX_CACHE_SIZE * 0.8) break; // Keep 20% buffer
        
        try {
          await FileSystem.deleteAsync(fileInfo.path, { idempotent: true });
          currentSize -= fileInfo.size;
        } catch (error) {
          console.warn('Failed to delete cached file:', fileInfo.path, error);
        }
      }
      
      console.log(`Cache cleaned, new size: ${(currentSize / 1024 / 1024).toFixed(1)}MB`);
    }
  } catch (error) {
    console.error('Error cleaning cache:', error);
  }
};

// Check if image is cached
export const isImageCached = async (url: string): Promise<boolean> => {
  try {
    await ensureCacheDirectory();
    const cachedPath = getCachedFilePath(url);
    const fileInfo = await FileSystem.getInfoAsync(cachedPath);
    return fileInfo.exists;
  } catch (error) {
    console.error('Error checking image cache:', error);
    return false;
  }
};

// Get cached image URI or original URL if not cached
export const getCachedImageUri = async (url: string): Promise<string> => {
  try {
    if (!url) return url;
    
    await ensureCacheDirectory();
    const cachedPath = getCachedFilePath(url);
    const fileInfo = await FileSystem.getInfoAsync(cachedPath);
    
    if (fileInfo.exists) {
      return cachedPath;
    }
    
    return url; // Return original URL if not cached
  } catch (error) {
    console.error('Error getting cached image URI:', error);
    return url;
  }
};

// Download and cache an image
export const cacheImage = async (url: string): Promise<string> => {
  try {
    if (!url) return url;
    
    await ensureCacheDirectory();
    const cachedPath = getCachedFilePath(url);
    
    // Check if already cached
    const fileInfo = await FileSystem.getInfoAsync(cachedPath);
    if (fileInfo.exists) {
      // Check if cache is still valid (not too old)
      const now = Date.now();
      const fileAge = now - ((fileInfo as any).modificationTime || 0) * 1000;
      
      if (fileAge < MAX_CACHE_AGE) {
        return cachedPath;
      } else {
        // Cache expired, delete and re-download
        await FileSystem.deleteAsync(cachedPath, { idempotent: true });
      }
    }
    
    // Clean cache if it's getting too large
    await cleanCacheIfNeeded();
    
    // Download and cache the image
    const downloadResult = await FileSystem.downloadAsync(url, cachedPath);
    
    if (downloadResult.status === 200) {
      return cachedPath;
    } else {
      console.error('Failed to download image:', downloadResult.status);
      return url;
    }
  } catch (error) {
    console.error('Error caching image:', error);
    return url;
  }
};

// Clear all cached images
export const clearImageCache = async (): Promise<void> => {
  try {
    const dirInfo = await FileSystem.getInfoAsync(IMAGE_CACHE_DIR);
    if (dirInfo.exists) {
      await FileSystem.deleteAsync(IMAGE_CACHE_DIR, { idempotent: true });
    }
  } catch (error) {
    console.error('Error clearing image cache:', error);
  }
};

// Preload/cache multiple images in background
export const preloadImages = async (urls: string[]): Promise<void> => {
  try {
    // Cache images in parallel, but limit concurrent downloads
    const BATCH_SIZE = 3;
    for (let i = 0; i < urls.length; i += BATCH_SIZE) {
      const batch = urls.slice(i, i + BATCH_SIZE);
      await Promise.allSettled(
        batch.map(url => url ? cacheImage(url) : Promise.resolve(url))
      );
    }
  } catch (error) {
    console.error('Error preloading images:', error);
  }
};
