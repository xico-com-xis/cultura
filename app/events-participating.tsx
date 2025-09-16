import { router, Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, TouchableOpacity, View, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import EventCard from '@/components/EventCard';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthContext';
import { Event, useEvents } from '@/context/EventsContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { ParticipantService } from '@/services/participantService';

type ParticipatingEvent = {
  event: Event;
  status: 'pending' | 'accepted' | 'declined';
};

export default function ParticipatingEventsScreen() {
  const { 
    events, 
    loading: eventsLoading, 
    refreshEvents
  } = useEvents();
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const [participatingEvents, setParticipatingEvents] = useState<ParticipatingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'pending' | 'accepted' | 'declined'>('accepted');

  const loadParticipatingEvents = useCallback(async () => {
    if (!user) {
      setParticipatingEvents([]);
      setLoading(false);
      return;
    }

    try {
      // Don't show loading for subsequent calls if we have data
      if (participatingEvents.length === 0) {
        setLoading(true);
      }
      
      // Get all events where the user is a participant
      const userParticipations = await ParticipantService.getEventsForUser(user.id);
      console.log('User participations:', userParticipations);
      
      // Match with actual events and include status
      const now = new Date();
      const participatingEventsData: ParticipatingEvent[] = userParticipations
        .map(participation => {
          const event = events.find(e => e.id === participation.eventId);
          if (!event) return null;
          
          return {
            event,
            status: participation.status
          };
        })
        .filter((item): item is ParticipatingEvent => item !== null)
        .filter(item => {
          // Only show future events (events where at least one schedule date is in the future)
          if (!item.event.schedule || item.event.schedule.length === 0) {
            // If no schedule, include the event (could be TBA)
            return true;
          }
          
          // Check if any scheduled date is in the future
          return item.event.schedule.some(schedule => {
            if (!schedule || !schedule.date) return false; // Skip invalid schedule entries
            const eventDate = new Date(schedule.date);
            return eventDate > now;
          });
        });
      
      // Sort by event date (earliest first)
      participatingEventsData.sort((a, b) => {
        const aDate = a.event.schedule && a.event.schedule.length > 0 && a.event.schedule[0]?.date 
          ? new Date(a.event.schedule[0].date) : new Date();
        const bDate = b.event.schedule && b.event.schedule.length > 0 && b.event.schedule[0]?.date 
          ? new Date(b.event.schedule[0].date) : new Date();
        return aDate.getTime() - bDate.getTime();
      });
      
      setParticipatingEvents(participatingEventsData);
    } catch (error) {
      console.error('Error loading participating events:', error);
      Alert.alert('Error', 'Failed to load your participating events');
    } finally {
      setLoading(false);
    }
  }, [user, events, participatingEvents.length]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshEvents(); // Refresh events first
      await loadParticipatingEvents(); // Then reload participations
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // Load participating events when component mounts or when user/events change
  useFocusEffect(
    useCallback(() => {
      loadParticipatingEvents();
    }, [loadParticipatingEvents])
  );

  // Also reload when events change (in case new events are added)
  useEffect(() => {
    if (!eventsLoading) {
      loadParticipatingEvents();
    }
  }, [events, eventsLoading, loadParticipatingEvents]);

  // Filter events based on status filter
  const filteredParticipatingEvents = participatingEvents.filter(item => {
    return item.status === filter;
  });

  const navigateToEvent = (event: Event) => {
    router.push({
      pathname: '/event/[id]',
      params: { id: event.id }
    });
  };

  const renderEventItem = ({ item }: { item: ParticipatingEvent }) => (
    <View style={styles.eventItem}>
      <TouchableOpacity onPress={() => navigateToEvent(item.event)}>
        <EventCard event={item.event} />
      </TouchableOpacity>
      <View style={[styles.statusBadge, styles[`statusBadge_${item.status}`]]}>
        <ThemedText style={[styles.statusText, styles[`statusText_${item.status}`]]}>
          {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
        </ThemedText>
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <ThemedView style={styles.centerContent}>
      <IconSymbol name="person.2" size={80} color="#ccc" />
      <ThemedText style={styles.emptyTitle}>No {filter.charAt(0).toUpperCase() + filter.slice(1)} Events</ThemedText>
      <ThemedText style={styles.emptyText}>
        {filter === 'pending' 
          ? "You don't have any pending participation requests."
          : filter === 'accepted'
          ? "You haven't accepted any event participations yet."
          : "You don't have any declined participation requests."
        }
      </ThemedText>
    </ThemedView>
  );

  // Get counts for each filter
  const pendingCount = participatingEvents.filter(item => item.status === 'pending').length;
  const acceptedCount = participatingEvents.filter(item => item.status === 'accepted').length;
  const declinedCount = participatingEvents.filter(item => item.status === 'declined').length;

  // Show consistent UI structure regardless of loading state
  return (
    <>
      <Stack.Screen 
        options={{
          headerShown: false,
        }} 
      />
      <ThemedView style={styles.container}>
        <ThemedView style={styles.header}>
          <TouchableOpacity 
            style={styles.headerBackButton}
            onPress={() => router.back()}
          >
            <IconSymbol name="chevron.left" size={24} color={Colors[colorScheme ?? 'light'].tint} />
          </TouchableOpacity>
          <ThemedText style={styles.headerTitle}>Participating Events</ThemedText>
          <View style={{ width: 40 }} />
        </ThemedView>

        {!user ? (
          <ThemedView style={styles.centerContent}>
            <IconSymbol name="person.circle" size={80} color="#ccc" />
            <ThemedText style={styles.emptyTitle}>Sign In Required</ThemedText>
            <ThemedText style={styles.emptyText}>
              Sign in to see events where you're tagged as a participant
            </ThemedText>
          </ThemedView>
        ) : (
          <>
            {/* Filter Tabs */}
            <ThemedView style={styles.filterContainer}>
              <View style={styles.filterTabs}>
                <TouchableOpacity
                  style={[styles.filterTab, filter === 'pending' && styles.filterTabActive]}
                  onPress={() => setFilter('pending')}
                >
                  <ThemedText style={[styles.filterTabText, filter === 'pending' && styles.filterTabTextActive]} numberOfLines={1}>
                    Pending ({pendingCount})
                  </ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.filterTab, filter === 'accepted' && styles.filterTabActive]}
                  onPress={() => setFilter('accepted')}
                >
                  <ThemedText style={[styles.filterTabText, filter === 'accepted' && styles.filterTabTextActive]} numberOfLines={1}>
                    Accepted ({acceptedCount})
                  </ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.filterTab, filter === 'declined' && styles.filterTabActive]}
                  onPress={() => setFilter('declined')}
                >
                  <ThemedText style={[styles.filterTabText, filter === 'declined' && styles.filterTabTextActive]} numberOfLines={1}>
                    Declined ({declinedCount})
                  </ThemedText>
                </TouchableOpacity>
              </View>
            </ThemedView>

            {/* Content */}
            <ThemedView style={styles.content}>
              {loading || eventsLoading ? (
                <ThemedView style={styles.centerContent}>
                  <ThemedText>Loading participating events...</ThemedText>
                </ThemedView>
              ) : filteredParticipatingEvents.length === 0 ? (
                renderEmptyState()
              ) : (
                <FlatList
                  data={filteredParticipatingEvents}
                  renderItem={renderEventItem}
                  keyExtractor={(item) => `${item.event.id}-${item.status}`}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.eventsList}
                  refreshControl={
                    <RefreshControl
                      refreshing={refreshing}
                      onRefresh={handleRefresh}
                      tintColor={Colors[colorScheme ?? 'light'].tint}
                    />
                  }
                />
              )}
            </ThemedView>
          </>
        )}
      </ThemedView>
    </>
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
    paddingTop: 50,
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
  filterContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  filterTabs: {
    flexDirection: 'row',
    gap: 8,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 20,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
  },
  filterTabActive: {
    backgroundColor: Colors.light.tint,
    borderColor: Colors.light.tint,
  },
  filterTabText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#666',
    textAlign: 'center',
  },
  filterTabTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  eventsList: {
    paddingTop: 16,
    paddingBottom: 20,
  },
  eventItem: {
    position: 'relative',
    marginBottom: 16,
  },
  statusBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 1,
  },
  statusBadge_pending: {
    backgroundColor: '#f59e0b',
  },
  statusBadge_accepted: {
    backgroundColor: '#10b981',
  },
  statusBadge_declined: {
    backgroundColor: '#ef4444',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  statusText_pending: {
    color: '#fff',
  },
  statusText_accepted: {
    color: '#fff',
  },
  statusText_declined: {
    color: '#fff',
  },
});