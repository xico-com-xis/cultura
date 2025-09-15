import * as Notifications from 'expo-notifications';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, FlatList, StyleSheet, TouchableOpacity, View, Image } from 'react-native';

import EventCard from '@/components/EventCard';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthContext';
import { Event, useEvents } from '@/context/EventsContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { supabase } from '@/lib/supabase';
import { registerForPushNotifications } from '@/services/notificationService';

type EventPeriod = 'future' | 'past';

interface UserProfile {
  id: string;
  display_name?: string;
  full_name?: string;
  avatar_url?: string;
  bio?: string;
  website?: string;
  email?: string;
  phone?: string;
  city?: string;
  country?: string;
  allow_contact_sharing?: boolean;
}

export default function ProfileDetailScreen() {
  const { id } = useLocalSearchParams();
  const { 
    events, 
    loading: eventsLoading, 
    favoritePerson, 
    unfavoritePerson, 
    isPersonFavorited,
    isGlobalNotificationEnabled 
  } = useEvents();
  const { user } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState<EventPeriod>('future');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const colorScheme = useColorScheme();
  
  // Animation for smooth tab transitions
  const fadeAnim = useRef(new Animated.Value(1)).current;
  
  // Convert id to string to ensure proper comparison
  const profileId = String(id);

  // Load profile data from database
  useEffect(() => {
    loadProfile();
  }, [profileId]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      
      // Query the profiles table directly
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', profileId)
        .single();

      if (error) {
        console.error('Error loading profile:', error);
        // If profile not found in database, show error
        setProfile(null);
      } else {
        setProfile(data);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  // Find events organized by this user
  const organizedEvents = events.filter(event => String(event.organizer.id) === profileId);
  
  // Find events where this user is a participant
  const participatedEvents = events.filter(event => 
    event.participants && event.participants.some(participant => String(participant.id) === profileId)
  );

  // Combine all events related to this user
  const allUserEvents = [...organizedEvents, ...participatedEvents].filter((event, index, self) => 
    index === self.findIndex(e => e.id === event.id) // Remove duplicates
  );

  const currentDate = new Date();
  
  // Filter events by selected period (future/past)
  const filteredEvents = allUserEvents.filter(event => {
    if (!event.schedule || event.schedule.length === 0) return false;
    
    const eventDate = new Date(event.schedule[0].date);
    
    if (selectedPeriod === 'future') {
      return eventDate >= currentDate;
    } else {
      return eventDate < currentDate;
    }
  }).sort((a, b) => {
    const aDate = new Date(a.schedule[0]?.date || 0);
    const bDate = new Date(b.schedule[0]?.date || 0);
    
    if (selectedPeriod === 'future') {
      return aDate.getTime() - bDate.getTime(); // Ascending for future events
    } else {
      return bDate.getTime() - aDate.getTime(); // Descending for past events
    }
  });

  const handlePeriodChange = (newPeriod: EventPeriod) => {
    if (newPeriod === selectedPeriod) return;
    
    // Fade out
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      // Change period
      setSelectedPeriod(newPeriod);
      // Fade in
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
    });
  };

  const navigateToEvent = (event: Event) => {
    router.push({
      pathname: '/event/[id]',
      params: { id: event.id }
    });
  };

  const handleFavoriteToggle = async () => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to favorite people');
      return;
    }

    try {
      const isFavorited = isPersonFavorited(profileId);
      if (isFavorited) {
        await unfavoritePerson(profileId);
      } else {
        // When favoriting a person, check if user has notification settings enabled
        // and register for push notifications if needed
        const hasNotificationsEnabled = isGlobalNotificationEnabled('reminders') || 
                                       isGlobalNotificationEnabled('updates') || 
                                       isGlobalNotificationEnabled('changes');
        
        if (hasNotificationsEnabled) {
          await checkAndRequestNotificationPermissions();
        }
        
        await favoritePerson(profileId);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update favorite status');
      console.error('Favorite toggle error:', error);
    }
  };

  const checkAndRequestNotificationPermissions = async (): Promise<boolean> => {
    if (!user) return false;
    
    try {
      // Use the centralized notification service to register for push notifications
      const token = await registerForPushNotifications(user.id);
      
      if (token) {
        return true;
      }
      
      // If registration failed, show appropriate message
      Alert.alert(
        'Notifications Disabled',
        'You have notification settings enabled but notifications are disabled. To receive event notifications, please enable notifications in your device settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Open Settings', 
            onPress: () => {
              Alert.alert(
                'Enable Notifications',
                'Go to Settings > Notifications > Cultura and enable notifications.',
                [{ text: 'OK' }]
              );
            }
          }
        ]
      );
      
      return false;
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      Alert.alert(
        'Notification Error',
        'Failed to set up notifications. Please try again later.',
        [{ text: 'OK' }]
      );
      return false;
    }
  };

  const renderEventItem = ({ item }: { item: Event }) => (
    <TouchableOpacity onPress={() => navigateToEvent(item)}>
      <EventCard event={item} />
    </TouchableOpacity>
  );

  const displayName = profile?.display_name || profile?.full_name || 'Unknown User';

  return (
    <View style={styles.container}>
      <ThemedView style={styles.container}>
        {/* Header */}
        <ThemedView style={styles.header}>
          <TouchableOpacity 
            style={styles.headerBackButton}
            onPress={() => router.back()}
          >
            <IconSymbol name="chevron.left" size={24} color={Colors[colorScheme ?? 'light'].tint} />
          </TouchableOpacity>
          <ThemedText style={styles.headerTitle}>Profile</ThemedText>
          <View style={styles.headerSpacer} />
        </ThemedView>

        {(loading || eventsLoading) ? (
          <ThemedView style={styles.centerContent}>
            <ThemedText>Loading profile...</ThemedText>
          </ThemedView>
        ) : !profile ? (
          <ThemedView style={styles.content}>
            <ThemedView style={styles.centerContent}>
              <IconSymbol name="person.circle" size={80} color="#ccc" />
              <ThemedText style={styles.emptyTitle}>Profile Not Found</ThemedText>
              <ThemedText style={styles.emptyText}>
                This person's profile is not available.
              </ThemedText>
              <ThemedText style={styles.debugText}>
                Profile ID: {profileId}
              </ThemedText>
            </ThemedView>
          </ThemedView>
        ) : (
          <ThemedView style={styles.content}>
          {/* Profile Info */}
          <ThemedView style={styles.profileInfo}>
            {profile.avatar_url ? (
              <Image 
                source={{ uri: profile.avatar_url }} 
                style={styles.profileAvatar}
              />
            ) : (
              <IconSymbol name="person.circle.fill" size={40} color={Colors[colorScheme ?? 'light'].tint} />
            )}
            <ThemedView style={styles.profileDetails}>
              <View style={styles.profileNameRow}>
                <ThemedText style={styles.profileName}>
                  {displayName}
                </ThemedText>
                {user && user.id !== profileId && (
                  <TouchableOpacity 
                    style={[
                      styles.followButton, 
                      isPersonFavorited(profileId) && styles.followButtonActive
                    ]}
                    onPress={handleFavoriteToggle}
                  >
                    <ThemedText style={[
                      styles.followButtonText,
                      isPersonFavorited(profileId) && styles.followButtonTextActive
                    ]}>
                      {isPersonFavorited(profileId) ? 'Following' : 'Follow'}
                    </ThemedText>
                  </TouchableOpacity>
                )}
              </View>
              
              {/* Bio */}
              {profile.bio && (
                <ThemedText style={styles.bio}>{profile.bio}</ThemedText>
              )}
              
              {/* Location */}
              {(profile.city || profile.country) && (
                <ThemedView style={styles.contactItem}>
                  <IconSymbol name="location" size={14} color="#666" />
                  <ThemedText style={styles.contactText}>
                    {[profile.city, profile.country].filter(Boolean).join(', ')}
                  </ThemedText>
                </ThemedView>
              )}
              
              {/* Contact Information */}
              {profile.allow_contact_sharing && (
                <ThemedView style={styles.contactSection}>
                  {profile.email && (
                    <ThemedView style={styles.contactItem}>
                      <IconSymbol name="envelope" size={14} color="#666" />
                      <ThemedText style={styles.contactText}>{profile.email}</ThemedText>
                    </ThemedView>
                  )}
                  {profile.phone && (
                    <ThemedView style={styles.contactItem}>
                      <IconSymbol name="phone" size={14} color="#666" />
                      <ThemedText style={styles.contactText}>{profile.phone}</ThemedText>
                    </ThemedView>
                  )}
                  {profile.website && (
                    <ThemedView style={styles.contactItem}>
                      <IconSymbol name="globe" size={14} color="#666" />
                      <ThemedText style={styles.contactText}>{profile.website}</ThemedText>
                    </ThemedView>
                  )}
                </ThemedView>
              )}
            </ThemedView>
          </ThemedView>

          {/* Events Section */}
          {allUserEvents.length > 0 && (
            <>
              {/* Event Period Selector */}
              <ThemedView style={styles.selectorContainer}>
                <ThemedView style={styles.periodSelector}>
                  <TouchableOpacity
                    style={[
                      styles.periodButton,
                      selectedPeriod === 'future' && styles.periodButtonActive
                    ]}
                    onPress={() => handlePeriodChange('future')}
                  >
                    <ThemedText style={[
                      styles.periodButtonText,
                      selectedPeriod === 'future' && styles.periodButtonTextActive
                    ]}>
                      Upcoming
                    </ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.periodButton,
                      selectedPeriod === 'past' && styles.periodButtonActive
                    ]}
                    onPress={() => handlePeriodChange('past')}
                  >
                    <ThemedText style={[
                      styles.periodButtonText,
                      selectedPeriod === 'past' && styles.periodButtonTextActive
                    ]}>
                      Past
                    </ThemedText>
                  </TouchableOpacity>
                </ThemedView>
              </ThemedView>

              {/* Events List */}
              <ThemedView style={styles.eventsContainer}>
                <Animated.View style={{ opacity: fadeAnim }}>
                  {filteredEvents.length > 0 ? (
                    <FlatList
                      key={selectedPeriod} // Add key to force re-render
                      data={filteredEvents}
                      renderItem={renderEventItem}
                      keyExtractor={(item) => item.id}
                      showsVerticalScrollIndicator={false}
                      contentContainerStyle={styles.eventsList}
                    />
                  ) : (
                    <ThemedView style={styles.emptyState}>
                      <IconSymbol 
                        name="calendar.badge.exclamationmark" 
                        size={48} 
                        color="#999" 
                      />
                      <ThemedText style={styles.emptyText}>
                        No {selectedPeriod} events found
                      </ThemedText>
                      <ThemedText style={styles.emptySubtext}>
                        {selectedPeriod === 'future' 
                          ? 'This person has no upcoming events'
                          : 'This person has no past events'
                        }
                      </ThemedText>
                    </ThemedView>
                  )}
                </Animated.View>
              </ThemedView>
            </>
          )}
          
          {/* No Events State */}
          {allUserEvents.length === 0 && (
            <ThemedView style={styles.emptyState}>
              <IconSymbol 
                name="calendar.badge.exclamationmark" 
                size={48} 
                color="#999" 
              />
              <ThemedText style={styles.emptyText}>
                No events found
              </ThemedText>
              <ThemedText style={styles.emptySubtext}>
                This person hasn't organized or participated in any events yet
              </ThemedText>
            </ThemedView>
          )}
        </ThemedView>
        )}
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 50, // Add top padding for status bar
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerBackButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40, // Same width as back button for centering
  },
  followButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.light.tint,
    backgroundColor: 'transparent',
    minWidth: 70,
    marginLeft: 8,
  },
  followButtonActive: {
    backgroundColor: Colors.light.tint,
    borderColor: Colors.light.tint,
  },
  followButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.tint,
  },
  followButtonTextActive: {
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  profileAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  profileDetails: {
    marginLeft: 12,
    flex: 1,
  },
  profileNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  profileName: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
  },
  bio: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 20,
  },
  contactSection: {
    marginTop: 8,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 6,
  },
  contactText: {
    fontSize: 12,
    color: '#666',
  },
  selectorContainer: {
    marginBottom: 16,
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderRadius: 25,
    padding: 4,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 21,
    alignItems: 'center',
  },
  periodButtonActive: {
    backgroundColor: Colors.light.tint,
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  periodButtonTextActive: {
    color: '#FFFFFF',
  },
  eventsContainer: {
    flex: 1,
  },
  eventsList: {
    paddingBottom: 20,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#999',
    marginTop: 12,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#999',
    marginTop: 12,
    textAlign: 'center',
  },
  debugText: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
    fontFamily: 'monospace',
  },
});
