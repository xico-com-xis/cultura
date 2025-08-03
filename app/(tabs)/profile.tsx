import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthContext';
import { useEvents } from '@/context/EventsContext';
import { useColorScheme } from '@/hooks/useColorScheme';

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
  const { filters, availableCountries, setSelectedCountry } = useEvents();
  const { user, signOut } = useAuth();
  const colorScheme = useColorScheme();
  const [countryModalVisible, setCountryModalVisible] = useState(false);

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
        <ThemedText type="title">Profile</ThemedText>
      </ThemedView>
      
      {user ? (
        // Show user profile when authenticated
        <>
          <ThemedView style={styles.profileInfo}>
            <View style={styles.userAvatarContainer}>
              <IconSymbol 
                name="person.crop.circle.fill" 
                size={80} 
                color={Colors[colorScheme ?? 'light'].tint}
              />
            </View>
            <ThemedText type="title" style={styles.userName}>
              {user?.user_metadata?.displayName || 'User'}
            </ThemedText>
            <ThemedText style={styles.userEmail}>{user?.email}</ThemedText>
            <TouchableOpacity 
              style={[styles.signOutButton, { backgroundColor: '#DC2626' }]}
              onPress={handleSignOut}
            >
              <IconSymbol name="rectangle.portrait.and.arrow.right" size={20} color="white" />
              <ThemedText style={styles.signOutText}>Sign Out</ThemedText>
            </TouchableOpacity>
          </ThemedView>

          {/* Country Selection Section - only show when logged in */}
          <ThemedView style={styles.section}>
            <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>Location Settings</ThemedText>
            <ThemedText style={styles.sectionDescription}>
              Select your country to see relevant events and cities in your area.
            </ThemedText>
            
            <TouchableOpacity 
              style={styles.countrySelector}
              onPress={() => setCountryModalVisible(true)}
            >
              <View style={styles.countrySelectorContent}>
                <View>
                  <ThemedText style={styles.countryLabel}>Country</ThemedText>
                  <ThemedText style={styles.countryValue}>
                    {countryFlags[filters.selectedCountry] || '🌍'} {filters.selectedCountry}
                  </ThemedText>
                </View>
                <IconSymbol 
                  name="chevron.right" 
                  size={20} 
                  color={Colors[colorScheme ?? 'light'].text} 
                />
              </View>
            </TouchableOpacity>
          </ThemedView>
          
          {/* Notifications & Favorites Section */}
          <ThemedView style={styles.section}>
            <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>Preferences</ThemedText>
            
            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => router.push('/notifications-favorites')}
            >
              <View style={styles.menuItemContent}>
                <View style={styles.menuItemLeft}>
                  <IconSymbol 
                    name="heart.fill" 
                    size={24} 
                    color={Colors[colorScheme ?? 'light'].tint} 
                  />
                  <View style={styles.menuItemText}>
                    <ThemedText style={styles.menuItemTitle}>Notifications & Favorites</ThemedText>
                    <ThemedText style={styles.menuItemSubtitle}>
                      Manage followed organizers and event notifications
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
          
          <ThemedView style={styles.section}>
            <ThemedText type="defaultSemiBold">My Events</ThemedText>
            <ThemedText>You haven't subscribed to any events yet.</ThemedText>
          </ThemedView>

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
    padding: 16,
  },
  header: {
    marginTop: 40,
    marginBottom: 20,
  },
  // User Profile Styles
  profileInfo: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    alignItems: 'center',
  },
  userAvatarContainer: {
    marginBottom: 16,
  },
  userName: {
    fontSize: 24,
    marginBottom: 8,
  },
  userEmail: {
    fontSize: 16,
    opacity: 0.7,
    marginBottom: 20,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
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
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
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
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
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
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    marginBottom: 8,
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
