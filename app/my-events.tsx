import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';

import EventCard from '@/components/EventCard';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthContext';
import { Event, useEvents } from '@/context/EventsContext';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function MyEventsScreen() {
  const { events, loading, deleteEvent } = useEvents();
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const [futureEvents, setFutureEvents] = useState<Event[]>([]);
  const [pastEvents, setPastEvents] = useState<Event[]>([]);

  // Filter and separate events where user is organizer or participant
  useEffect(() => {
    if (user && events.length > 0) {
      // Include events where user is organizer OR participant
      const userEvents = events.filter(event => {
        // Check if user is the organizer
        const isOrganizer = event.organizer.id === user.id;
        
        // Check if user is tagged as a participant
        const isParticipant = event.participants && 
                             event.participants.some(participant => participant.id === user.id);
        
        return isOrganizer || isParticipant;
      });
      const now = new Date();
      
      const future: Event[] = [];
      const past: Event[] = [];
      
      userEvents.forEach(event => {
        // Check if event has TBA date (no schedule or invalid dates)
        const hasTBADate = !event.schedule || 
                          event.schedule.length === 0 || 
                          event.schedule.every(schedule => !schedule || !schedule.date);
        
        // If event has TBA date, always put it in future events
        if (hasTBADate) {
          future.push(event);
          return;
        }
        
        // Check if any schedule date is in the future
        const hasFutureDate = event.schedule.some(schedule => {
          if (!schedule || !schedule.date) return false;
          try {
            return new Date(schedule.date) >= now;
          } catch (error) {
            // If date parsing fails, treat as TBA and put in future
            return true;
          }
        });
        
        if (hasFutureDate) {
          future.push(event);
        } else {
          past.push(event);
        }
      });
      
      // Sort future events by earliest date (ascending)
      future.sort((a, b) => {
        const dateA = new Date(a.schedule[0]?.date || 0);
        const dateB = new Date(b.schedule[0]?.date || 0);
        return dateA.getTime() - dateB.getTime();
      });
      
      // Sort past events by most recent date (descending)
      past.sort((a, b) => {
        const dateA = new Date(a.schedule[a.schedule.length - 1]?.date || 0);
        const dateB = new Date(b.schedule[b.schedule.length - 1]?.date || 0);
        return dateB.getTime() - dateA.getTime();
      });
      
      setFutureEvents(future);
      setPastEvents(past);
    } else {
      setFutureEvents([]);
      setPastEvents([]);
    }
  }, [user, events]);

  const navigateToEvent = (event: Event) => {
    router.push({
      pathname: '/event/[id]',
      params: { id: event.id }
    });
  };

  const isEventInPast = (event: Event) => {
    // Events with TBA dates are never considered past events
    const hasTBADate = !event.schedule || 
                      event.schedule.length === 0 || 
                      event.schedule.every(schedule => !schedule || !schedule.date);
    
    if (hasTBADate) {
      return false;
    }
    
    const now = new Date();
    return event.schedule.every(schedule => {
      if (!schedule || !schedule.date) return false;
      try {
        return new Date(schedule.date) < now;
      } catch (error) {
        // If date parsing fails, treat as TBA and not past
        return false;
      }
    });
  };

  const handleCancelEvent = (event: Event) => {
    Alert.alert(
      'Cancel Event',
      `Are you sure you want to cancel "${event.title}"? This action cannot be undone.`,
      [
        {
          text: 'Keep Event',
          style: 'cancel',
        },
        {
          text: 'Cancel Event',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteEvent(event.id);
              Alert.alert('Success', 'Event has been cancelled successfully.');
            } catch (error) {
              Alert.alert('Error', 'Failed to cancel the event. Please try again.');
              console.error('Error cancelling event:', error);
            }
          },
        },
      ]
    );
  };

  const handleEditEvent = (event: Event) => {
    // Navigate to edit event screen
    router.push({
      pathname: '/edit-event/[id]',
      params: { id: event.id }
    });
  };

  const renderEventItem = ({ item }: { item: Event }) => {
    const isPast = isEventInPast(item);
    
    return (
      <View style={styles.eventItemWrapper}>
        <TouchableOpacity 
          onPress={() => navigateToEvent(item)}
          style={styles.eventCardContainer}
        >
          <EventCard event={item} showShadow={false} />
        </TouchableOpacity>
        <View style={styles.eventStatus}>
          <View style={styles.statusRow}>
            <View style={[styles.statusBadge, isPast && styles.pastEventBadge]}>
              <IconSymbol 
                name={isPast ? "checkmark.circle.fill" : "checkmark.circle.fill"} 
                size={16} 
                color={isPast ? "#666" : Colors[colorScheme ?? 'light'].tint} 
              />
              <ThemedText style={[styles.statusText, isPast && styles.pastStatusText]}>
                {isPast ? 'Occurred' : 'Published'}
              </ThemedText>
            </View>
          </View>
          {!isPast && user && item.organizer.id === user.id && (
            <View style={styles.actionButtons}>
              <TouchableOpacity 
                style={styles.editButton}
                onPress={() => handleEditEvent(item)}
              >
                <IconSymbol name="pencil" size={16} color="#4C8BF5" />
                <ThemedText style={styles.editText}>Edit</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => handleCancelEvent(item)}
              >
                <IconSymbol name="trash" size={16} color="#DC2626" />
                <ThemedText style={styles.cancelText}>Cancel</ThemedText>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <ThemedView style={styles.emptyContainer}>
      <IconSymbol name="calendar.badge.plus" size={80} color="#ccc" />
      <ThemedText style={styles.emptyTitle}>No Events Created</ThemedText>
      <ThemedText style={styles.emptyText}>
        You haven't created any events yet. Start by creating your first event to share with the community!
      </ThemedText>
      <TouchableOpacity 
        style={[styles.createButton, { backgroundColor: Colors[colorScheme ?? 'light'].tint }]}
        onPress={() => router.push('/(tabs)/map')}
      >
        <IconSymbol name="plus" size={20} color="white" />
        <ThemedText style={styles.createButtonText}>Create Your First Event</ThemedText>
      </TouchableOpacity>
    </ThemedView>
  );

  if (!user) {
    return (
      <ThemedView style={styles.container}>
        <ThemedView style={styles.emptyContainer}>
          <IconSymbol name="person.circle" size={80} color="#ccc" />
          <ThemedText style={styles.emptyTitle}>Sign In Required</ThemedText>
          <ThemedText style={styles.emptyText}>
            Sign in to view and manage the events you've created
          </ThemedText>
        </ThemedView>
      </ThemedView>
    );
  }

  const totalEvents = futureEvents.length + pastEvents.length;

  return (
    <>
      <Stack.Screen 
        options={{
          title: 'My Events',
          headerBackTitle: 'Profile'
        }} 
      />
      <ThemedView style={styles.container}>
        <ThemedView style={styles.content}>
          {loading ? (
            <ThemedView style={styles.emptyContainer}>
              <ThemedText>Loading your events...</ThemedText>
            </ThemedView>
          ) : totalEvents === 0 ? (
            renderEmptyState()
          ) : (
            <FlatList
              data={[...futureEvents, ...pastEvents]}
              renderItem={({ item, index }) => {
                const isSeparatorNeeded = index === futureEvents.length && pastEvents.length > 0;
                return (
                  <>
                    {isSeparatorNeeded && (
                      <View style={styles.sectionSeparator}>
                        <ThemedText style={styles.sectionTitle}>Past Events</ThemedText>
                      </View>
                    )}
                    {index === 0 && futureEvents.length > 0 && (
                      <View style={styles.sectionSeparator}>
                        <ThemedText style={styles.sectionTitle}>Upcoming Events</ThemedText>
                      </View>
                    )}
                    {renderEventItem({ item })}
                  </>
                );
              }}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.eventsList}
            />
          )}
        </ThemedView>
      </ThemedView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  eventsList: {
    paddingVertical: 16,
  },
  eventItemWrapper: {
    marginBottom: 24, // Increase space between event groups
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
    borderRadius: 12,
  },
  eventCardContainer: {
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    overflow: 'hidden',
  },
  eventStatus: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    marginTop: 0, // Seamless connection with event card
    marginBottom: 8, // Add space from next event
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 200, 0, 0.1)',
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#00c853',
  },
  pastEventBadge: {
    backgroundColor: 'rgba(102, 102, 102, 0.1)',
  },
  pastStatusText: {
    color: '#666',
  },
  sectionSeparator: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.light.tint, // Solid blue background
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white', // White text on blue background
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 8,
  },
  createButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    gap: 4,
  },
  cancelText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#DC2626',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(76, 139, 245, 0.1)',
    gap: 4,
  },
  editText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#4C8BF5',
  },
});
