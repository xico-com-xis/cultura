import { supabase } from '@/lib/supabase';
import * as ImagePicker from 'expo-image-picker';

export interface ImageUploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

/**
 * Request camera and media library permissions
 */
export const requestImagePermissions = async (): Promise<boolean> => {
  try {
    // Request camera permissions
    const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
    
    // Request media library permissions
    const mediaPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    return cameraPermission.status === 'granted' && mediaPermission.status === 'granted';
  } catch (error) {
    console.error('Error requesting permissions:', error);
    return false;
  }
};

/**
 * Show image picker with camera and library options
 */
export const pickImage = async (): Promise<ImagePicker.ImagePickerResult | null> => {
  try {
    const hasPermissions = await requestImagePermissions();
    
    if (!hasPermissions) {
      throw new Error('Camera and media library permissions are required');
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9], // Good aspect ratio for event images
      quality: 0.8, // Compress to reduce file size
      exif: false, // Don't include EXIF data for privacy
    });

    return result;
  } catch (error) {
    console.error('Error picking image:', error);
    return null;
  }
};

/**
 * Take a photo with camera
 */
export const takePhoto = async (): Promise<ImagePicker.ImagePickerResult | null> => {
  try {
    const hasPermissions = await requestImagePermissions();
    
    if (!hasPermissions) {
      throw new Error('Camera permissions are required');
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
      exif: false,
    });

    return result;
  } catch (error) {
    console.error('Error taking photo:', error);
    return null;
  }
};

/**
 * Upload image to Supabase Storage
 */
export const uploadImageToSupabase = async (
  imageUri: string,
  userId: string,
  eventTitle: string
): Promise<ImageUploadResult> => {
  try {
    console.log('Starting image upload to Supabase...');
    
    // Create a unique filename
    const timestamp = Date.now();
    const sanitizedTitle = eventTitle.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    const fileName = `${userId}_${sanitizedTitle}_${timestamp}.jpg`;
    const filePath = fileName; // No folder prefix

    // Convert image URI to blob
    console.log('Converting image URI to blob...');
    console.log('Original image URI:', imageUri);
    
    // For React Native, we need to handle the URI differently
    let blob: Blob;
    
    if (imageUri.startsWith('file://') || imageUri.startsWith('content://')) {
      // React Native file URI - use FormData approach
      console.log('Detected React Native file URI, using FormData approach');
      
      const formData = new FormData();
      formData.append('file', {
        uri: imageUri,
        type: 'image/jpeg',
        name: fileName,
      } as any);
      
      // Upload using FormData with timeout
      console.log('Uploading with FormData...');
      
      // Create a promise that will timeout after 60 seconds
      const uploadPromise = supabase.storage
        .from('event-images')
        .upload(filePath, formData, {
          cacheControl: '3600',
          upsert: false,
        });
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Network request timed out')), 60000);
      });
      
      const { data, error } = await Promise.race([uploadPromise, timeoutPromise]) as any;

      if (error) {
        console.error('FormData upload error:', error);
        return {
          success: false,
          error: `Upload failed: ${error.message}`
        };
      }

      console.log('FormData upload successful:', data);

      // Get the public URL
      const { data: urlData } = supabase.storage
        .from('event-images')
        .getPublicUrl(filePath);

      return {
        success: true,
        url: urlData.publicUrl
      };
      
    } else {
      // Web URI - use fetch approach
      console.log('Detected web URI, using fetch approach');
      const response = await fetch(imageUri);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
      }
      
      blob = await response.blob();
    }
    
    console.log('Uploading file:', fileName);
    console.log('File size:', blob.size);
    console.log('File type:', blob.type);

    if (blob.size === 0) {
      throw new Error('Image blob is empty - the image URI might be invalid');
    }

    // Try to upload directly with timeout
    console.log('Attempting blob upload to event-images bucket...');
    
    const uploadPromise = supabase.storage
      .from('event-images')
      .upload(filePath, blob, {
        cacheControl: '3600',
        upsert: false,
        contentType: 'image/jpeg'
      });
    
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Network request timed out')), 60000);
    });
    
    const { data, error } = await Promise.race([uploadPromise, timeoutPromise]) as any;

    if (error) {
      console.error('Supabase upload error details:', {
        message: error.message,
        error: error
      });
      
      // Provide more specific error messages
      let userFriendlyError = error.message;
      if (error.message.includes('bucket')) {
        userFriendlyError = 'Storage bucket access issue. Please check if the "event-images" bucket exists and is properly configured.';
      } else if (error.message.includes('policy')) {
        userFriendlyError = 'Permission denied. Please check your storage policies allow authenticated users to upload.';
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        userFriendlyError = 'Network error. Please check your internet connection and Supabase configuration.';
      }
      
      return {
        success: false,
        error: `Upload failed: ${userFriendlyError}`
      };
    }

    console.log('Upload successful:', data);

    // Get the public URL
    const { data: urlData } = supabase.storage
      .from('event-images')
      .getPublicUrl(filePath);

    const publicUrl = urlData.publicUrl;
    console.log('Public URL:', publicUrl);

    return {
      success: true,
      url: publicUrl
    };

  } catch (error) {
    console.error('Error uploading image:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
};

/**
 * Delete image from Supabase Storage
 */
export const deleteImageFromSupabase = async (imageUrl: string): Promise<boolean> => {
  try {
    // Extract file path from URL
    const urlParts = imageUrl.split('/');
    const fileName = urlParts[urlParts.length - 1];
    const filePath = fileName; // No folder prefix since we're storing in root

    const { error } = await supabase.storage
      .from('event-images')
      .remove([filePath]);

    if (error) {
      console.error('Error deleting image:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error deleting image:', error);
    return false;
  }
};

/**
 * Test Supabase Storage connection and bucket access
 */
export const testSupabaseStorage = async (): Promise<{
  success: boolean;
  message: string;
  buckets?: string[];
  details?: any;
}> => {
  try {
    console.log('Testing Supabase Storage connection...');
    
    // Test 1: List all buckets
    console.log('Step 1: Testing bucket listing...');
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      return {
        success: false,
        message: `Failed to list buckets: ${bucketsError.message}`,
        details: bucketsError
      };
    }
    
    const bucketNames = buckets?.map(b => b.name) || [];
    console.log('Available buckets:', bucketNames);
    
    // Test 2: Check if event-images bucket exists in the list
    const hasEventImagesBucket = bucketNames.includes('event-images');
    
    if (!hasEventImagesBucket) {
      return {
        success: false,
        message: `Bucket "event-images" not found in list. Available: ${bucketNames.join(', ') || 'none'}`,
        buckets: bucketNames
      };
    }
    
    // Test 3: Try to access the bucket directly (list files)
    console.log('Step 2: Testing direct bucket access...');
    const { data: files, error: filesError } = await supabase.storage
      .from('event-images')
      .list('', { limit: 1 });
    
    if (filesError) {
      return {
        success: false,
        message: `Cannot access event-images bucket: ${filesError.message}`,
        buckets: bucketNames,
        details: filesError
      };
    }
    
    // Test 4: Try a test upload (create a small test file)
    console.log('Step 3: Testing upload capability...');
    const testBlob = new Blob(['test'], { type: 'text/plain' });
    const testFileName = `test_${Date.now()}.txt`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('event-images')
      .upload(testFileName, testBlob, {
        cacheControl: '3600',
        upsert: false
      });
    
    if (uploadError) {
      return {
        success: false,
        message: `Upload test failed: ${uploadError.message}. This indicates a policy issue.`,
        buckets: bucketNames,
        details: uploadError
      };
    }
    
    // Clean up test file
    await supabase.storage
      .from('event-images')
      .remove([testFileName]);
    
    return {
      success: true,
      message: `✅ All tests passed! Storage is properly configured.`,
      buckets: bucketNames,
      details: { filesCount: files?.length || 0 }
    };
    
  } catch (error) {
    return {
      success: false,
      message: `Storage test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: error
    };
  }
};

/**
 * Test if an image URL is publicly accessible
 */
export const testImageAccess = async (imageUrl: string): Promise<{
  success: boolean;
  message: string;
}> => {
  try {
    console.log('Testing image URL access:', imageUrl);
    
    const response = await fetch(imageUrl, { method: 'HEAD' });
    
    if (response.ok) {
      return {
        success: true,
        message: `✅ Image is publicly accessible (${response.status})`
      };
    } else {
      return {
        success: false,
        message: `❌ Image access failed: ${response.status} ${response.statusText}`
      };
    }
    
  } catch (error) {
    return {
      success: false,
      message: `❌ Network error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
};

/**
 * Compress and resize image if needed
 */
export const processImage = async (imageUri: string): Promise<string> => {
  // For now, return the original URI
  // In the future, you could add image processing logic here
  return imageUri;
};
