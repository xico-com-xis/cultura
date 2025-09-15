import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActionSheetIOS, ActivityIndicator, Alert, Image, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthContext';
import { useEvents } from '@/context/EventsContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { supabase } from '@/lib/supabase';
import { pickImage, takePhoto } from '@/utils/imageUpload';

// Login Form Component
function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [displayName, setDisplayName] = useState('');
  
  const { signIn, signUp } = useAuth();
  const colorScheme = useColorScheme();

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (isSignUp && !displayName) {
      Alert.alert('Error', 'Please enter a display name');
      return;
    }

    setLoading(true);

    try {
      let result;
      if (isSignUp) {
        result = await signUp(email, password, { displayName });
        if (!result.error) {
          Alert.alert('Success', 'Account created! Welcome to Cultura!');
        }
      } else {
        result = await signIn(email, password);
        if (!result.error) {
          Alert.alert('Success', 'Welcome back!');
        }
      }

      if (result.error) {
        Alert.alert('Error', result.error.message || 'Authentication failed');
      }
    } catch (error) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setEmail('');
    setPassword('');
    setDisplayName('');
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.keyboardView}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.loginHeader}>
          <IconSymbol 
            name="person.crop.circle.fill" 
            size={60} 
            color={Colors[colorScheme ?? 'light'].tint}
          />
          <ThemedText style={styles.loginTitle}>
            {isSignUp ? 'Join Cultura' : 'Welcome Back'}
          </ThemedText>
          <ThemedText style={styles.loginSubtitle}>
            {isSignUp 
              ? 'Sign up to personalize your cultural experience' 
              : 'Sign in to access your personalized content'
            }
          </ThemedText>
        </View>

        <View style={styles.loginForm}>
          {isSignUp && (
            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>Display Name</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: Colors[colorScheme ?? 'light'].background,
                    borderColor: Colors[colorScheme ?? 'light'].text + '30',
                    color: Colors[colorScheme ?? 'light'].text,
                  }
                ]}
                placeholder="Enter your display name"
                placeholderTextColor={Colors[colorScheme ?? 'light'].text + '70'}
                value={displayName}
                onChangeText={setDisplayName}
                autoCapitalize="words"
              />
            </View>
          )}

          <View style={styles.inputContainer}>
            <ThemedText style={styles.label}>Email</ThemedText>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: Colors[colorScheme ?? 'light'].background,
                  borderColor: Colors[colorScheme ?? 'light'].text + '30',
                  color: Colors[colorScheme ?? 'light'].text,
                }
              ]}
              placeholder="Enter your email"
              placeholderTextColor={Colors[colorScheme ?? 'light'].text + '70'}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          </View>

          <View style={styles.inputContainer}>
            <ThemedText style={styles.label}>Password</ThemedText>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: Colors[colorScheme ?? 'light'].background,
                  borderColor: Colors[colorScheme ?? 'light'].text + '30',
                  color: Colors[colorScheme ?? 'light'].text,
                }
              ]}
              placeholder="Enter your password"
              placeholderTextColor={Colors[colorScheme ?? 'light'].text + '70'}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password"
            />
          </View>

          <TouchableOpacity
            style={[
              styles.authButton,
              { backgroundColor: Colors[colorScheme ?? 'light'].tint }
            ]}
            onPress={handleAuth}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.authButtonText}>
                {isSignUp ? 'Sign Up' : 'Sign In'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.toggleButton}
            onPress={toggleMode}
            disabled={loading}
          >
            <ThemedText style={styles.toggleText}>
              {isSignUp 
                ? 'Already have an account? Sign In' 
                : "Don't have an account? Sign Up"
              }
            </ThemedText>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export default function ProfileScreen() {
  const { filters, availableCountries, setSelectedCountry, events } = useEvents();
  const { user, signOut } = useAuth();
  const colorScheme = useColorScheme();
  const [countryModalVisible, setCountryModalVisible] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  // Load user's avatar from profiles table
  useEffect(() => {
    if (user?.id) {
      loadUserAvatar();
    }
  }, [user?.id]);

  const loadUserAvatar = async () => {
    try {
      if (!user?.id) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', user.id)
        .single();

      if (error) {
        console.log('No profile found or error loading avatar:', error);
        return;
      }

      if (data?.avatar_url) {
        setAvatarUri(data.avatar_url);
      }
    } catch (error) {
      console.error('Error loading user avatar:', error);
    }
  };

  // Get user's created events count
  const userEventsCount = user ? events.filter(event => event.organizer.id === user.id).length : 0;
  const totalOccurrences = user ? events
    .filter(event => event.organizer.id === user.id)
    .reduce((total, event) => total + event.schedule.length, 0) : 0;

  // Country flag mapping
  const countryFlags: Record<string, string> = {
    'Portugal': '🇵🇹',
    'Spain': '🇪🇸',
    'France': '🇫🇷',
    'Italy': '🇮🇹',
    'Germany': '🇩🇪',
    'United Kingdom': '🇬🇧',
    'Netherlands': '🇳🇱',
    'Belgium': '🇧🇪',
  };

  const handleCountrySelect = (country: string) => {
    setSelectedCountry(country);
    setCountryModalVisible(false);
  };

  const uploadAvatarToSupabase = async (imageUri: string): Promise<{ success: boolean; url?: string; error?: string }> => {
    try {
      if (!user?.id) {
        return { success: false, error: 'User not authenticated' };
      }

      console.log('Uploading avatar to Supabase...');
      
      // Create a unique filename for the avatar
      const timestamp = Date.now();
      const fileName = `avatar_${user.id}_${timestamp}.jpg`;
      
      // Convert image URI to blob/FormData for upload
      let uploadData: any;
      
      if (imageUri.startsWith('file://') || imageUri.startsWith('content://')) {
        // React Native file URI - use FormData approach
        uploadData = new FormData();
        uploadData.append('file', {
          uri: imageUri,
          type: 'image/jpeg',
          name: fileName,
        } as any);
      } else {
        // Web URI - use fetch approach
        const response = await fetch(imageUri);
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.status}`);
        }
        uploadData = await response.blob();
      }

      // Upload to avatars folder in event-images bucket
      const { data, error } = await supabase.storage
        .from('event-images')
        .upload(`avatars/${fileName}`, uploadData, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) {
        console.error('Avatar upload error:', error);
        return { success: false, error: error.message };
      }

      // Get the public URL
      const { data: urlData } = supabase.storage
        .from('event-images')
        .getPublicUrl(`avatars/${fileName}`);

      return { success: true, url: urlData.publicUrl };
    } catch (error) {
      console.error('Error uploading avatar:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  };

  const updateUserAvatar = async (avatarUrl: string) => {
    try {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      // Update the avatar_url in the profiles table
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString(),
        });

      if (error) {
        console.error('Error updating profile:', error);
        throw error;
      }

      console.log('Profile updated successfully');
    } catch (error) {
      console.error('Error updating user avatar:', error);
      throw error;
    }
  };

  const handleAvatarPicker = () => {
    if (!user) {
      Alert.alert('Error', 'Please sign in to update your profile picture');
      return;
    }

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Choose from Library', 'Take Photo'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            selectAvatarFromLibrary();
          } else if (buttonIndex === 2) {
            takeAvatarPhoto();
          }
        }
      );
    } else {
      Alert.alert(
        'Select Profile Picture',
        'Choose how you want to add your profile picture',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Choose from Library', onPress: selectAvatarFromLibrary },
          { text: 'Take Photo', onPress: takeAvatarPhoto },
        ]
      );
    }
  };

  const selectAvatarFromLibrary = async () => {
    try {
      const result = await pickImage();
      if (result && !result.canceled && result.assets && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        await uploadAndSetAvatar(imageUri);
      }
    } catch (error) {
      console.error('Error selecting avatar:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };

  const takeAvatarPhoto = async () => {
    try {
      const result = await takePhoto();
      if (result && !result.canceled && result.assets && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        await uploadAndSetAvatar(imageUri);
      }
    } catch (error) {
      console.error('Error taking avatar photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const uploadAndSetAvatar = async (imageUri: string) => {
    setIsUploadingAvatar(true);
    try {
      // Upload the image
      const uploadResult = await uploadAvatarToSupabase(imageUri);
      
      if (!uploadResult.success || !uploadResult.url) {
        throw new Error(uploadResult.error || 'Upload failed');
      }

      // Update the user's profile in the database
      await updateUserAvatar(uploadResult.url);

      // Update local state
      setAvatarUri(uploadResult.url);
      
      Alert.alert('Success', 'Profile picture updated successfully!');
    } catch (error) {
      console.error('Avatar upload/update error:', error);
      Alert.alert(
        'Update Failed',
        error instanceof Error ? error.message : 'Failed to update profile picture. Please try again.'
      );
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => signOut(),
        },
      ]
    );
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.header}>
        <ThemedText type="title" style={styles.headerTitle}>Profile</ThemedText>
        {user && (
          <TouchableOpacity 
            style={[styles.signOutButton, { backgroundColor: '#DC2626' }]}
            onPress={handleSignOut}
          >
            <IconSymbol name="rectangle.portrait.and.arrow.right" size={18} color="white" />
          </TouchableOpacity>
        )}
      </ThemedView>
      
      {user ? (
        // Show user profile when authenticated
        <>
          <ScrollView 
            style={styles.scrollViewContainer}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
            indicatorStyle="default"
          >
          <ThemedView style={styles.profileInfo}>
            <TouchableOpacity 
              style={styles.userAvatarContainer}
              onPress={handleAvatarPicker}
              disabled={isUploadingAvatar}
            >
              {isUploadingAvatar ? (
                <View style={styles.avatarLoadingContainer}>
                  <ActivityIndicator size="large" color={Colors[colorScheme ?? 'light'].tint} />
                </View>
              ) : avatarUri ? (
                <Image 
                  source={{ uri: avatarUri }} 
                  style={styles.avatarImage}
                />
              ) : (
                <IconSymbol 
                  name="person.crop.circle.fill" 
                  size={60} 
                  color={Colors[colorScheme ?? 'light'].tint}
                />
              )}
              <View style={styles.avatarEditIcon}>
                <IconSymbol 
                  name="camera.fill" 
                  size={16} 
                  color="#fff"
                />
              </View>
            </TouchableOpacity>
            <ThemedText type="title" style={styles.userName}>
              {user?.user_metadata?.displayName || 'User'}
            </ThemedText>
            <ThemedText style={styles.userEmail}>{user?.email}</ThemedText>
          </ThemedView>

          {/* Events Section */}
          <ThemedView style={styles.section}>
            <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>Events</ThemedText>
            
            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => router.push('/my-events' as any)}
            >
              <View style={styles.menuItemContent}>
                <View style={styles.menuItemLeft}>
                  <IconSymbol 
                    name="calendar.badge.plus" 
                    size={24} 
                    color={Colors[colorScheme ?? 'light'].tint} 
                  />
                  <View style={styles.menuItemText}>
                    <ThemedText style={styles.menuItemTitle}>Organized</ThemedText>
                    <ThemedText style={styles.menuItemSubtitle}>
                      {userEventsCount === 0 
                        ? 'Create your first event'
                        : `${userEventsCount} ${userEventsCount === 1 ? 'event' : 'events'} created${totalOccurrences > userEventsCount ? ` • ${totalOccurrences} occurrences` : ''}`
                      }
                    </ThemedText>
                  </View>
                </View>
                <IconSymbol 
                  name="chevron.right" 
                  size={20} 
                  color={Colors[colorScheme ?? 'light'].text} 
                />
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => router.push('/participating-events')}
            >
              <View style={styles.menuItemContent}>
                <View style={styles.menuItemLeft}>
                  <IconSymbol 
                    name="person.2.fill" 
                    size={24} 
                    color={Colors[colorScheme ?? 'light'].tint} 
                  />
                  <View style={styles.menuItemText}>
                    <ThemedText style={styles.menuItemTitle}>Participating</ThemedText>
                    <ThemedText style={styles.menuItemSubtitle}>
                      Events where you're tagged as participant
                    </ThemedText>
                  </View>
                </View>
                <IconSymbol 
                  name="chevron.right" 
                  size={20} 
                  color={Colors[colorScheme ?? 'light'].text} 
                />
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => router.push('/following-events')}
            >
              <View style={styles.menuItemContent}>
                <View style={styles.menuItemLeft}>
                  <IconSymbol 
                    name="heart.fill" 
                    size={24} 
                    color={Colors[colorScheme ?? 'light'].tint} 
                  />
                  <View style={styles.menuItemText}>
                    <ThemedText style={styles.menuItemTitle}>Following</ThemedText>
                    <ThemedText style={styles.menuItemSubtitle}>
                      Events you're following for updates
                    </ThemedText>
                  </View>
                </View>
                <IconSymbol 
                  name="chevron.right" 
                  size={20} 
                  color={Colors[colorScheme ?? 'light'].text} 
                />
              </View>
            </TouchableOpacity>
          </ThemedView>

          {/* People and Tags Section */}
          <ThemedView style={styles.section}>
            <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>People</ThemedText>
            
            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => router.push('/people-following')}
            >
              <View style={styles.menuItemContent}>
                <View style={styles.menuItemLeft}>
                  <IconSymbol 
                    name="person.2.circle.fill" 
                    size={24} 
                    color={Colors[colorScheme ?? 'light'].tint} 
                  />
                  <View style={styles.menuItemText}>
                    <ThemedText style={styles.menuItemTitle}>Following</ThemedText>
                    <ThemedText style={styles.menuItemSubtitle}>
                      People and organizers you follow
                    </ThemedText>
                  </View>
                </View>
                <IconSymbol 
                  name="chevron.right" 
                  size={20} 
                  color={Colors[colorScheme ?? 'light'].text} 
                />
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => router.push('/people-followers')}
            >
              <View style={styles.menuItemContent}>
                <View style={styles.menuItemLeft}>
                  <IconSymbol 
                    name="person.3.fill" 
                    size={24} 
                    color={Colors[colorScheme ?? 'light'].tint} 
                  />
                  <View style={styles.menuItemText}>
                    <ThemedText style={styles.menuItemTitle}>Followers</ThemedText>
                    <ThemedText style={styles.menuItemSubtitle}>
                      People following you
                    </ThemedText>
                  </View>
                </View>
                <IconSymbol 
                  name="chevron.right" 
                  size={20} 
                  color={Colors[colorScheme ?? 'light'].text} 
                />
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => router.push('/tag-requests')}
            >
              <View style={styles.menuItemContent}>
                <View style={styles.menuItemLeft}>
                  <IconSymbol 
                    name="person.badge.plus" 
                    size={24} 
                    color={Colors[colorScheme ?? 'light'].tint} 
                  />
                  <View style={styles.menuItemText}>
                    <ThemedText style={styles.menuItemTitle}>Tag Requests</ThemedText>
                    <ThemedText style={styles.menuItemSubtitle}>
                      Requests to be tagged in events
                    </ThemedText>
                  </View>
                </View>
                <IconSymbol 
                  name="chevron.right" 
                  size={20} 
                  color={Colors[colorScheme ?? 'light'].text} 
                />
              </View>
            </TouchableOpacity>
          </ThemedView>

          {/* Settings Section */}
          <ThemedView style={styles.section}>
            <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>Settings</ThemedText>
            
            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => setCountryModalVisible(true)}
            >
              <View style={styles.menuItemContent}>
                <View style={styles.menuItemLeft}>
                  <IconSymbol 
                    name="location.fill" 
                    size={24} 
                    color={Colors[colorScheme ?? 'light'].tint} 
                  />
                  <View style={styles.menuItemText}>
                    <ThemedText style={styles.menuItemTitle}>Country Selection</ThemedText>
                    <ThemedText style={styles.menuItemSubtitle}>
                      {countryFlags[filters.selectedCountry] || '🌍'} {filters.selectedCountry}
                    </ThemedText>
                  </View>
                </View>
                <IconSymbol 
                  name="chevron.right" 
                  size={20} 
                  color={Colors[colorScheme ?? 'light'].text} 
                />
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => router.push('/notification-settings')}
            >
              <View style={styles.menuItemContent}>
                <View style={styles.menuItemLeft}>
                  <IconSymbol 
                    name="bell.fill" 
                    size={24} 
                    color={Colors[colorScheme ?? 'light'].tint} 
                  />
                  <View style={styles.menuItemText}>
                    <ThemedText style={styles.menuItemTitle}>Notification Settings</ThemedText>
                    <ThemedText style={styles.menuItemSubtitle}>
                      Manage push notifications and alerts
                    </ThemedText>
                  </View>
                </View>
                <IconSymbol 
                  name="chevron.right" 
                  size={20} 
                  color={Colors[colorScheme ?? 'light'].text} 
                />
              </View>
            </TouchableOpacity>
          </ThemedView>
          
          <View style={{ height: 30 }} />
        </ScrollView>

        {/* Country Selection Modal */}
        <View 
          style={[
            styles.modalOverlay,
            countryModalVisible && { backgroundColor: 'rgb(0, 0, 0)' }
          ]}
          pointerEvents={countryModalVisible ? 'auto' : 'none'}
        ></View>
        <Modal
          visible={countryModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setCountryModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <ThemedView style={[styles.modalContent, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
              <View style={styles.modalHeader}>
                <ThemedText style={styles.modalTitle}>Select Country</ThemedText>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setCountryModalVisible(false)}
                >
                  <ThemedText style={styles.closeButtonText}>✕</ThemedText>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.countryList}>
                {availableCountries.map((country) => (
                  <TouchableOpacity
                    key={country}
                    style={[
                      styles.countryListItem,
                      country === filters.selectedCountry && styles.selectedCountryItem
                    ]}
                    onPress={() => handleCountrySelect(country)}
                  >
                    <View style={styles.countryItemContent}>
                      <ThemedText style={[
                        styles.countryItemText,
                        country === filters.selectedCountry && styles.selectedCountryText
                      ]}>
                        {countryFlags[country] || '🌍'} {country}
                      </ThemedText>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </ThemedView>
          </View>
        </Modal>
        </>
      ) : (
        // Show login form when not authenticated
        <LoginForm />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 8,
  },
  header: {
    marginTop: 40,
    marginBottom: 20,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
  },
  // User Profile Styles
  profileInfo: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  userAvatarContainer: {
    marginBottom: 12,
    position: 'relative',
  },
  avatarImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f0f0f0',
  },
  avatarLoadingContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarEditIcon: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: Colors.light.tint,
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  userName: {
    fontSize: 20,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 16,
  },
  signOutButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  signOutText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  // Login Form Styles
  keyboardView: {
    flex: 1,
  },
  scrollViewContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  loginHeader: {
    alignItems: 'center',
    marginBottom: 40,
  },
  loginTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  loginSubtitle: {
    fontSize: 16,
    opacity: 0.8,
    textAlign: 'center',
    lineHeight: 22,
  },
  loginForm: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    minHeight: 56,
  },
  authButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 16,
    minHeight: 56,
  },
  authButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  toggleButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  toggleText: {
    fontSize: 16,
    opacity: 0.8,
  },
  // Country Selection Styles
  section: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: 'rgba(255, 255, 255, 1)',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 16,
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 16,
    lineHeight: 20,
  },
  countrySelector: {
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 8,
    padding: 12,
  },
  countrySelectorContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  countryLabel: {
    fontSize: 12,
    opacity: 0.6,
    marginBottom: 4,
  },
  countryValue: {
    fontSize: 16,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.5,
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#666',
  },
  countryList: {
    marginBottom: 24,
  },
  countryListItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  selectedCountryItem: {
    backgroundColor: Colors.light.tint,
    borderColor: Colors.light.tint,
  },
  countryItemContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  countryItemText: {
    fontSize: 16,
  },
  selectedCountryText: {
    color: '#fff',
    fontWeight: '600',
  },
  menuItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    marginBottom: 6,
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuItemText: {
    marginLeft: 16,
    flex: 1,
  },
  menuItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  menuItemSubtitle: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
});
