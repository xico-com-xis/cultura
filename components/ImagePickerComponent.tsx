import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { ImageUploadResult, pickImage, takePhoto, uploadImageToSupabase } from '@/utils/imageUpload';
import React, { useState } from 'react';
import {
    ActionSheetIOS,
    ActivityIndicator,
    Alert,
    Image,
    Platform,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';

interface ImagePickerComponentProps {
  onImageSelected: (imageUrl: string) => void;
  currentImageUrl?: string;
  userId: string;
  eventTitle: string;
  allowRemove?: boolean;
}

export default function ImagePickerComponent({
  onImageSelected,
  currentImageUrl,
  userId,
  eventTitle,
  allowRemove = true,
}: ImagePickerComponentProps) {
  const colorScheme = useColorScheme();
  const [isUploading, setIsUploading] = useState(false);
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);

  const handleImagePicker = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Choose from Library', 'Take Photo'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            selectFromLibrary();
          } else if (buttonIndex === 2) {
            takeNewPhoto();
          }
        }
      );
    } else {
      // For Android, show a simple alert
      Alert.alert(
        'Select Image',
        'Choose how you want to add an image',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Choose from Library', onPress: selectFromLibrary },
          { text: 'Take Photo', onPress: takeNewPhoto },
        ]
      );
    }
  };

  const selectFromLibrary = async () => {
    try {
      const result = await pickImage();
      if (result && !result.canceled && result.assets && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        setLocalImageUri(imageUri);
        await uploadImage(imageUri);
      }
    } catch (error) {
      console.error('Error selecting image:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };

  const takeNewPhoto = async () => {
    try {
      const result = await takePhoto();
      if (result && !result.canceled && result.assets && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        setLocalImageUri(imageUri);
        await uploadImage(imageUri);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const uploadImage = async (imageUri: string) => {
    if (!eventTitle.trim()) {
      Alert.alert('Error', 'Please enter an event title before adding an image.');
      return;
    }

    setIsUploading(true);
    try {
      const result: ImageUploadResult = await uploadImageToSupabase(
        imageUri,
        userId,
        eventTitle
      );

      if (result.success && result.url) {
        onImageSelected(result.url);
        Alert.alert('Success', 'Image uploaded successfully!');
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert(
        'Upload Failed',
        error instanceof Error ? error.message : 'Failed to upload image. Please try again.'
      );
      setLocalImageUri(null);
    } finally {
      setIsUploading(false);
    }
  };

  const removeImage = () => {
    if (!allowRemove) {
      Alert.alert('Image Required', 'An image is required for all events.');
      return;
    }
    
    Alert.alert(
      'Remove Image',
      'Are you sure you want to remove this image?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setLocalImageUri(null);
            onImageSelected('');
          },
        },
      ]
    );
  };

  const displayImageUri = localImageUri || currentImageUrl;

  return (
    <View style={styles.container}>      
      {displayImageUri ? (
        <View style={styles.imageContainer}>
          <Image source={{ uri: displayImageUri }} style={styles.image} />
          {isUploading && (
            <View style={styles.uploadingOverlay}>
              <ActivityIndicator size="large" color="#fff" />
              <ThemedText style={styles.uploadingText}>Uploading...</ThemedText>
            </View>
          )}
          {allowRemove && (
            <TouchableOpacity style={styles.removeButton} onPress={removeImage}>
              <IconSymbol name="xmark.circle.fill" size={24} color="#ff3b30" />
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <TouchableOpacity
          style={[
            styles.imagePicker,
            {
              borderColor: Colors[colorScheme ?? 'light'].text + '30',
              backgroundColor: Colors[colorScheme ?? 'light'].background,
            },
          ]}
          onPress={handleImagePicker}
          disabled={isUploading}
        >
          {isUploading ? (
            <ActivityIndicator size="large" color={Colors[colorScheme ?? 'light'].tint} />
          ) : (
            <>
              <IconSymbol 
                name="photo" 
                size={40} 
                color={Colors[colorScheme ?? 'light'].text + '60'} 
              />
              <ThemedText style={[styles.imagePickerText, { opacity: 0.6 }]}>
                Tap to add image *
              </ThemedText>
              <ThemedText style={[styles.imagePickerSubtext, { opacity: 0.4 }]}>
                Required - Choose from library or take photo
              </ThemedText>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  imagePicker: {
    height: 200,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  imagePickerText: {
    fontSize: 16,
    fontWeight: '500',
  },
  imagePickerSubtext: {
    fontSize: 12,
  },
  imageContainer: {
    position: 'relative',
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    resizeMode: 'cover',
  },
  removeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 2,
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  uploadingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
