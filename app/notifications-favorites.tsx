import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Animated, FlatList, Modal, StyleSheet, TouchableOpacity, View } from 'react-native';

import EventCard from '@/components/EventCard';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useAuth } from '@/context/AuthContext';
import { Event, NotificationType, useEvents } from '@/context/EventsContext';

type ViewMode = 'events' | 'people';

export default function NotificationsFavoritesScreen() {
  const { 
    events, 
    loading, 
    favoriteState, 
    updateGlobalNotificationSetting, 
    isGlobalNotificationEnabled 
  } = useEvents();
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('events');
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const slideAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    if (showNotificationSettings) {
      Animated.spring(slideAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [showNotificationSettings]);

  if (!user) {
    return (
      <ThemedView style={styles.container}>
        <ThemedView style={styles.header}>
          <TouchableOpacity 
            style={styles.headerBackButton}
            onPress={() => router.back()}
          >
            <IconSymbol name="chevron.left" size={24} color="#007AFF" />
          </TouchableOpacity>
          <ThemedText style={styles.headerTitle}>Notifications & Favorites</ThemedText>
          <View style={{ width: 40 }} />
        </ThemedView>
        <ThemedView style={styles.centerContent}>
          <IconSymbol name="person.circle" size={80} color="#ccc" />
          <ThemedText style={styles.emptyTitle}>Sign In Required</ThemedText>
          <ThemedText style={styles.emptyText}>
            Sign in to favorite events and people, and manage notifications
          </ThemedText>
        </ThemedView>
      </ThemedView>
    );
  }

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ThemedView style={styles.header}>
          <TouchableOpacity 
            style={styles.headerBackButton}
            onPress={() => router.back()}
          >
            <IconSymbol name="chevron.left" size={24} color="#007AFF" />
          </TouchableOpacity>
          <ThemedText style={styles.headerTitle}>Notifications & Favorites</ThemedText>
          <TouchableOpacity 
            style={styles.headerSettingsButton}
            onPress={() => setShowNotificationSettings(true)}
          >
            <IconSymbol name="gearshape.fill" size={24} color="#007AFF" />
          </TouchableOpacity>
        </ThemedView>
        <ThemedView style={styles.centerContent}>
          <ThemedText>Loading...</ThemedText>
        </ThemedView>
      </ThemedView>
    );
  }

  // Get favorited events
  const favoriteEvents = events.filter(event => 
    favoriteState.favoriteEvents.has(event.id)
  );

  // Get unique organizers from favorited people
  const favoriteOrganizers = events
    .filter(event => favoriteState.favoritePeople.has(event.organizer.id))
    .reduce((acc, event) => {
      const organizer = event.organizer;
      if (!acc.find(org => org.id === organizer.id)) {
        acc.push(organizer);
      }
      return acc;
    }, [] as Array<{ id: string; name: string; }>);

  const navigateToEvent = (event: Event) => {
    router.push({
      pathname: '/event/[id]',
      params: { id: event.id }
    });
  };

  const navigateToOrganizer = (organizerId: string) => {
    router.push({
      pathname: '/organizer/[id]',
      params: { id: organizerId }
    });
  };

  const handleNotificationToggle = async (notificationType: NotificationType) => {
    try {
      const currentState = isGlobalNotificationEnabled(notificationType);
      await updateGlobalNotificationSetting(notificationType, !currentState);
    } catch (error) {
      Alert.alert('Error', 'Failed to update notification settings');
      console.error('Notification toggle error:', error);
    }
  };

  const notificationTypes: { type: NotificationType; label: string; description: string }[] = [
    { type: 'reminders', label: 'Event reminders', description: 'Get reminded before favorited events start' },
    { type: 'updates', label: 'Event updates', description: 'Get notified about updates to favorited events' },
    { type: 'changes', label: 'Schedule changes', description: 'Get notified when event times or venues change' },
  ];

  const renderEventItem = ({ item }: { item: Event }) => (
    <TouchableOpacity onPress={() => navigateToEvent(item)}>
      <EventCard event={item} />
    </TouchableOpacity>
  );

  const renderOrganizerItem = ({ item }: { item: { id: string; name: string; } }) => (
    <TouchableOpacity 
      style={styles.organizerItem}
      onPress={() => navigateToOrganizer(item.id)}
    >
      <View style={styles.organizerContent}>
        <IconSymbol name="person.circle.fill" size={40} color="#4C8BF5" />
        <View style={styles.organizerText}>
          <ThemedText style={styles.organizerName}>{item.name}</ThemedText>
          <ThemedText style={styles.organizerSubtitle}>Tap to view organizer page</ThemedText>
        </View>
        <IconSymbol name="chevron.right" size={20} color="#666" />
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <ThemedView style={styles.centerContent}>
      <IconSymbol 
        name={viewMode === 'events' ? "heart" : "person.2"} 
        size={80} 
        color="#ccc" 
      />
      <ThemedText style={styles.emptyTitle}>
        {viewMode === 'events' ? 'No Favorite Events' : 'No Favorite People'}
      </ThemedText>
      <ThemedText style={styles.emptyText}>
        {viewMode === 'events' 
          ? 'Heart events to see them here'
          : 'Heart organizers to see them here'
        }
      </ThemedText>
    </ThemedView>
  );

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.header}>
        <TouchableOpacity 
          style={styles.headerBackButton}
          onPress={() => router.back()}
        >
          <IconSymbol name="chevron.left" size={24} color="#007AFF" />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>Notifications & Favorites</ThemedText>
        <TouchableOpacity 
          style={styles.headerSettingsButton}
          onPress={() => setShowNotificationSettings(true)}
        >
          <IconSymbol name="gearshape.fill" size={24} color="#007AFF" />
        </TouchableOpacity>
      </ThemedView>

      {/* Mode Selector */}
      <ThemedView style={styles.selectorContainer}>
        <ThemedView style={styles.modeSelector}>
          <TouchableOpacity
            style={[
              styles.modeButton,
              viewMode === 'events' && styles.modeButtonActive
            ]}
            onPress={() => setViewMode('events')}
          >
            <ThemedText style={[
              styles.modeButtonText,
              viewMode === 'events' && styles.modeButtonTextActive
            ]}>
              Events ({favoriteState.favoriteEvents.size})
            </ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.modeButton,
              viewMode === 'people' && styles.modeButtonActive
            ]}
            onPress={() => setViewMode('people')}
          >
            <ThemedText style={[
              styles.modeButtonText,
              viewMode === 'people' && styles.modeButtonTextActive
            ]}>
              People ({favoriteState.favoritePeople.size})
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </ThemedView>

      {/* Content */}
      <ThemedView style={styles.content}>
        {viewMode === 'events' ? (
          favoriteEvents.length === 0 ? (
            renderEmptyState()
          ) : (
            <FlatList
              data={favoriteEvents}
              renderItem={renderEventItem}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.eventsList}
            />
          )
        ) : (
          favoriteOrganizers.length === 0 ? (
            renderEmptyState()
          ) : (
            <FlatList
              data={favoriteOrganizers}
              renderItem={renderOrganizerItem}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.eventsList}
            />
          )
        )}
      </ThemedView>

      {/* Notification Settings Modal */}
      <Modal
        visible={showNotificationSettings}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowNotificationSettings(false)}
      >
        <View style={styles.modalOverlay}>
          <Animated.View style={[
            styles.modalContent,
            {
              transform: [{
                translateY: slideAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [400, 0],
                })
              }]
            }
          ]}>
            <ThemedView style={styles.modalInner}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Notification Settings</ThemedText>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowNotificationSettings(false)}
              >
                <IconSymbol name="xmark" size={20} color="#666" />
              </TouchableOpacity>
            </View>
            
            <ThemedText style={styles.modalDescription}>
              These settings apply to all your favorited events
            </ThemedText>

            {notificationTypes.map((notif) => (
              <TouchableOpacity
                key={notif.type}
                style={styles.notificationItem}
                onPress={() => handleNotificationToggle(notif.type)}
              >
                <View style={styles.notificationContent}>
                  <View style={styles.notificationText}>
                    <ThemedText style={styles.notificationLabel}>{notif.label}</ThemedText>
                    <ThemedText style={styles.notificationDescription}>
                      {notif.description}
                    </ThemedText>
                  </View>
                  <View style={[
                    styles.notificationToggle,
                    isGlobalNotificationEnabled(notif.type) && styles.notificationToggleActive
                  ]}>
                    <View style={[
                      styles.notificationToggleThumb,
                      isGlobalNotificationEnabled(notif.type) && styles.notificationToggleThumbActive
                    ]} />
                  </View>
                </View>
              </TouchableOpacity>
            ))}
            </ThemedView>
          </Animated.View>
        </View>
      </Modal>
    </ThemedView>
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
  headerSettingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectorContainer: {
    padding: 16,
  },
  modeSelector: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderRadius: 25,
    padding: 4,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 21,
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: '#4C8BF5',
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  modeButtonTextActive: {
    color: 'white',
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
    paddingBottom: 20,
  },
  organizerItem: {
    marginBottom: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    borderRadius: 12,
    padding: 16,
  },
  organizerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  organizerText: {
    marginLeft: 12,
    flex: 1,
  },
  organizerName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  organizerSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    justifyContent: 'flex-end',
  },
  modalInner: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
  },
  notificationItem: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  notificationText: {
    flex: 1,
    marginRight: 16,
  },
  notificationLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  notificationDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
  notificationToggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  notificationToggleActive: {
    backgroundColor: '#4C8BF5',
  },
  notificationToggleThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  notificationToggleThumbActive: {
    transform: [{ translateX: 20 }],
  },
});
