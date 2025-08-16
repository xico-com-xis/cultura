import { isAfter, isBefore } from 'date-fns';
import * as Notifications from 'expo-notifications';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';

import EventCard from '@/components/EventCard';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useAuth } from '@/context/AuthContext';
import { Event, useEvents } from '@/context/EventsContext';

type EventPeriod = 'future' | 'past';

export default function OrganizerDetailScreen() {
  const { id } = useLocalSearchParams();
  const { 
    events, 
    loading, 
    favoritePerson, 
    unfavoritePerson, 
    isPersonFavorited,
    isGlobalNotificationEnabled 
  } = useEvents();
  const { user } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState<EventPeriod>('future');
  
  // Convert id to string to ensure proper comparison
  const organizerId = String(id);
  
  // Find all events by this organizer
  const organizerEvents = events.filter(event => String(event.organizer.id) === organizerId);
  
  // Get organizer info from the first event (they should all have the same organizer info)
  const organizer = organizerEvents.length > 0 ? organizerEvents[0].organizer : null;
  
  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>Loading organizer...</ThemedText>
      </ThemedView>
    );
  }

  if (!organizer || organizerEvents.length === 0) {
    return (
      <View style={styles.container}>
        <ThemedView style={styles.container}>
          {/* Header */}
          <ThemedView style={styles.header}>
            <TouchableOpacity 
              style={styles.headerBackButton}
              onPress={() => router.back()}
            >
              <IconSymbol name="chevron.left" size={24} color="#007AFF" />
            </TouchableOpacity>
            <ThemedText style={styles.headerTitle}>Organizer</ThemedText>
            <View style={styles.headerSpacer} />
          </ThemedView>
          
          <ThemedView style={styles.content}>
            <ThemedText>Organizer not found</ThemedText>
            <ThemedText>Looking for ID: {id}</ThemedText>
          </ThemedView>
        </ThemedView>
      </View>
    );
  }

  // Filter events by selected period
  const now = new Date();
  const filteredEvents = organizerEvents.filter(event => {
    if (event.schedule.length === 0) return selectedPeriod === 'future'; // Default to future if no schedule
    
    if (!event.schedule[0] || !event.schedule[0].date) return selectedPeriod === 'future'; // Handle invalid schedule
    const eventDate = new Date(event.schedule[0].date);
    
    if (selectedPeriod === 'future') {
      return isAfter(eventDate, now);
    } else {
      return isBefore(eventDate, now);
    }
  }).sort((a, b) => {
    // Sort by date
    const dateA = a.schedule.length > 0 && a.schedule[0] && a.schedule[0].date 
      ? new Date(a.schedule[0].date) : new Date();
    const dateB = b.schedule.length > 0 && b.schedule[0] && b.schedule[0].date 
      ? new Date(b.schedule[0].date) : new Date();
    
    if (selectedPeriod === 'future') {
      return dateA.getTime() - dateB.getTime(); // Ascending for future events
    } else {
      return dateB.getTime() - dateA.getTime(); // Descending for past events
    }
  });

  const navigateToEvent = (event: Event) => {
    router.push({
      pathname: '/event/[id]',
      params: { id: event.id }
    });
  };

  const handleFavoriteToggle = async () => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to favorite organizers');
      return;
    }

    try {
      const isFavorited = isPersonFavorited(organizerId);
      if (isFavorited) {
        await unfavoritePerson(organizerId);
      } else {
        // When favoriting an organizer, check if user has notification settings enabled
        // and request permissions if needed
        const hasNotificationsEnabled = isGlobalNotificationEnabled('reminders') || 
                                       isGlobalNotificationEnabled('updates') || 
                                       isGlobalNotificationEnabled('changes');
        
        if (hasNotificationsEnabled) {
          await checkAndRequestNotificationPermissions();
        }
        
        await favoritePerson(organizerId);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update favorite status');
      console.error('Favorite toggle error:', error);
    }
  };

  const checkAndRequestNotificationPermissions = async (): Promise<boolean> => {
    try {
      // First check current permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      
      if (existingStatus === 'granted') {
        return true;
      }
      
      // If not granted, request permissions
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
      
      if (status === 'granted') {
        return true;
      }
      
      // Handle different denial scenarios
      if (status === 'denied') {
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
      } else {
        Alert.alert(
          'Notification Permission Required',
          'You have notification settings enabled but we need permission to send notifications.',
          [{ text: 'OK' }]
        );
      }
      
      return false;
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return false;
    }
  };

  const renderEventItem = ({ item }: { item: Event }) => (
    <TouchableOpacity onPress={() => navigateToEvent(item)}>
      <EventCard event={item} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <ThemedView style={styles.container}>
        {/* Header */}
        <ThemedView style={styles.header}>
          <TouchableOpacity 
            style={styles.headerBackButton}
            onPress={() => router.back()}
          >
            <IconSymbol name="chevron.left" size={24} color="#007AFF" />
          </TouchableOpacity>
          <ThemedText style={styles.headerTitle}>Organizer</ThemedText>
          {user && (
            <TouchableOpacity 
              style={[
                styles.followButton, 
                isPersonFavorited(organizerId) && styles.followButtonActive
              ]}
              onPress={handleFavoriteToggle}
            >
              <IconSymbol 
                name={isPersonFavorited(organizerId) ? "heart.fill" : "heart"} 
                size={20} 
                color={isPersonFavorited(organizerId) ? "#fff" : "#4C8BF5"} 
              />
            </TouchableOpacity>
          )}
          {!user && <View style={styles.headerSpacer} />}
        </ThemedView>
        
        <ThemedView style={styles.content}>
          {/* Organizer Info - Compact */}
          <ThemedView style={styles.organizerInfo}>
            <IconSymbol name="person.circle.fill" size={40} color="#4C8BF5" />
            <ThemedView style={styles.organizerDetails}>
              <ThemedText style={styles.organizerName}>
                {organizer.name}
              </ThemedText>
              
              {/* Contact Information - Compact */}
              {organizer.contact && organizer.allowContactSharing && (
                <ThemedView style={styles.contactSection}>
                  {organizer.contact.email && (
                    <ThemedView style={styles.contactItem}>
                      <IconSymbol name="envelope" size={14} color="#666" />
                      <ThemedText style={styles.contactText}>{organizer.contact.email}</ThemedText>
                    </ThemedView>
                  )}
                  {organizer.contact.phone && (
                    <ThemedView style={styles.contactItem}>
                      <IconSymbol name="phone" size={14} color="#666" />
                      <ThemedText style={styles.contactText}>{organizer.contact.phone}</ThemedText>
                    </ThemedView>
                  )}
                  {organizer.contact.website && (
                    <ThemedView style={styles.contactItem}>
                      <IconSymbol name="globe" size={14} color="#666" />
                      <ThemedText style={styles.contactText}>{organizer.contact.website}</ThemedText>
                    </ThemedView>
                  )}
                </ThemedView>
              )}
            </ThemedView>
          </ThemedView>

          {/* Statistics - Compact */}
          <ThemedView style={styles.statsContainer}>
            <View style={styles.statItem}>
              <ThemedText style={styles.statNumber}>{organizerEvents.length}</ThemedText>
              <ThemedText style={styles.statLabel}>Total</ThemedText>
            </View>
            <View style={styles.statItem}>
              <ThemedText style={styles.statNumber}>
                {organizerEvents.filter(e => e.schedule.length > 0 && e.schedule[0] && e.schedule[0].date && isAfter(new Date(e.schedule[0].date), now)).length}
              </ThemedText>
              <ThemedText style={styles.statLabel}>Upcoming</ThemedText>
            </View>
            <View style={styles.statItem}>
              <ThemedText style={styles.statNumber}>
                {organizerEvents.filter(e => e.schedule.length > 0 && e.schedule[0] && e.schedule[0].date && isBefore(new Date(e.schedule[0].date), now)).length}
              </ThemedText>
              <ThemedText style={styles.statLabel}>Past</ThemedText>
            </View>
          </ThemedView>

          {/* Event Period Selector */}
          <ThemedView style={styles.selectorContainer}>
            <ThemedView style={styles.periodSelector}>
              <TouchableOpacity
                style={[
                  styles.periodButton,
                  selectedPeriod === 'future' && styles.periodButtonActive
                ]}
                onPress={() => setSelectedPeriod('future')}
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
                onPress={() => setSelectedPeriod('past')}
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
            {filteredEvents.length > 0 ? (
              <FlatList
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
                    ? 'This organizer has no upcoming events'
                    : 'This organizer has no past events'
                  }
                </ThemedText>
              </ThemedView>
            )}
          </ThemedView>
        </ThemedView>
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
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#4C8BF5',
    backgroundColor: 'transparent',
  },
  followButtonActive: {
    backgroundColor: '#4C8BF5',
    borderColor: '#4C8BF5',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  organizerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  organizerDetails: {
    marginLeft: 12,
    flex: 1,
  },
  organizerName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
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
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    paddingVertical: 12,
    marginBottom: 20,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4C8BF5',
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
    backgroundColor: '#4C8BF5',
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  periodButtonTextActive: {
    color: 'white',
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
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
});
