import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';

import EditEventForm from '@/components/EditEventForm';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { Event, useEvents } from '@/context/EventsContext';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function EditEventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { events } = useEvents();
  const colorScheme = useColorScheme();
  const [event, setEvent] = useState<Event | null>(null);

  useEffect(() => {
    if (id) {
      const foundEvent = events.find(e => e.id === id);
      setEvent(foundEvent || null);
    }
  }, [id, events]);

  const handleClose = () => {
    router.back();
  };

  const handleEventUpdated = () => {
    // Navigate back to the event details or my events page
    router.back();
  };

  if (!event) {
    return (
      <>
        <Stack.Screen 
          options={{
            title: 'Edit Event',
            headerBackTitle: 'Back'
          }} 
        />
        <ThemedView style={styles.container}>
          <ThemedView style={styles.errorContainer}>
            <IconSymbol name="exclamationmark.triangle" size={80} color="#ff9500" />
            <ThemedText style={styles.errorTitle}>Event Not Found</ThemedText>
            <ThemedText style={styles.errorText}>
              The event you're trying to edit could not be found.
            </ThemedText>
            <TouchableOpacity 
              style={[styles.backButton, { backgroundColor: Colors[colorScheme ?? 'light'].tint }]}
              onPress={handleClose}
            >
              <ThemedText style={styles.backButtonText}>Go Back</ThemedText>
            </TouchableOpacity>
          </ThemedView>
        </ThemedView>
      </>
    );
  }

  return (
    <>
      <Stack.Screen 
        options={{
          title: 'Edit Event',
          headerBackTitle: 'Back'
        }} 
      />
      <ThemedView style={styles.container}>
        <EditEventForm
          event={event}
          onClose={handleClose}
          onEventUpdated={handleEventUpdated}
        />
      </ThemedView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  backButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
