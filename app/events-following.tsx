import * as Notifications from 'expo-notifications';
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

export default function FollowingEventsScreen() {
  const { 
    events, 
    loading, 
    favoriteState
  } = useEvents();
  const { user } = useAuth();
  const colorScheme = useColorScheme();

  if (!user) {
    return (
      <ThemedView style={styles.container}>
        <ThemedView style={styles.header}>
          <TouchableOpacity 
            style={styles.headerBackButton}
            onPress={() => router.back()}
          >
            <IconSymbol name="chevron.left" size={24} color={Colors[colorScheme ?? 'light'].tint} />
          </TouchableOpacity>
          <ThemedText style={styles.headerTitle}>Following Events</ThemedText>
          <View style={{ width: 40 }} />
        </ThemedView>
        <ThemedView style={styles.centerContent}>
          <IconSymbol name="person.circle" size={80} color="#ccc" />
          <ThemedText style={styles.emptyTitle}>Sign In Required</ThemedText>
          <ThemedText style={styles.emptyText}>
            Sign in to follow events and manage notifications
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
            <IconSymbol name="chevron.left" size={24} color={Colors[colorScheme ?? 'light'].tint} />
          </TouchableOpacity>
          <ThemedText style={styles.headerTitle}>Following Events</ThemedText>
          <View style={{ width: 40 }} />
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

  const navigateToEvent = (event: Event) => {
    router.push({
      pathname: '/event/[id]',
      params: { id: event.id }
    });
  };

  const renderEventItem = ({ item }: { item: Event }) => (
    <TouchableOpacity onPress={() => navigateToEvent(item)}>
      <EventCard event={item} />
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <ThemedView style={styles.centerContent}>
      <IconSymbol name="heart" size={80} color="#ccc" />
      <ThemedText style={styles.emptyTitle}>No Following Events</ThemedText>
      <ThemedText style={styles.emptyText}>
        Heart events to follow them and see them here. You'll receive notifications about updates and reminders.
      </ThemedText>
    </ThemedView>
  );

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
        <ThemedText style={styles.headerTitle}>Following Events</ThemedText>
        <View style={{ width: 40 }} />
      </ThemedView>

      {/* Events Counter */}
      <ThemedView style={styles.counterContainer}>
        <ThemedText style={styles.counterText}>
          {favoriteEvents.length} {favoriteEvents.length === 1 ? 'event' : 'events'} followed
        </ThemedText>
      </ThemedView>

      {/* Content */}
      <ThemedView style={styles.content}>
        {favoriteEvents.length === 0 ? (
          renderEmptyState()
        ) : (
          <FlatList
            data={favoriteEvents}
            renderItem={renderEventItem}
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
  counterContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  counterText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
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
});