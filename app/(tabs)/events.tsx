import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, TouchableOpacity } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';

// Sample event data - replace with your API
const SAMPLE_EVENTS = [
  { 
    id: '1', 
    title: 'Art Exhibition', 
    date: '2025-05-15',
    location: 'City Gallery',
    description: 'Featuring works from local artists'
  },
  { 
    id: '2', 
    title: 'Music Festival', 
    date: '2025-06-20',
    location: 'Central Park',
    description: 'Live performances from 12 bands'
  },
  { 
    id: '3', 
    title: 'Cultural Workshop', 
    date: '2025-05-28',
    location: 'Community Center',
    description: 'Learn traditional crafts and cooking'
  },
];

function EventCard({ event, onSubscribe }) {
  return (
    <ThemedView style={styles.card}>
      <ThemedText type="title">{event.title}</ThemedText>
      <ThemedText>{event.date} • {event.location}</ThemedText>
      <ThemedText style={styles.description}>{event.description}</ThemedText>
      
      <TouchableOpacity 
        style={styles.subscribeButton}
        onPress={() => onSubscribe(event.id)}>
        <ThemedText type="defaultSemiBold">Subscribe</ThemedText>
      </TouchableOpacity>
    </ThemedView>
  );
}

export default function EventsScreen() {
  const [events, setEvents] = useState(SAMPLE_EVENTS);
  
  const handleSubscribe = (eventId) => {
    // Implement subscription logic here
    console.log(`Subscribed to event ${eventId}`);
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.header}>
        <ThemedText type="title">Upcoming Events</ThemedText>
        <TouchableOpacity onPress={() => router.push('/events/search')}>
          <IconSymbol name="magnifyingglass" size={24} color="#808080" />
        </TouchableOpacity>
      </ThemedView>
      
      <FlatList
        data={events}
        renderItem={({ item }) => (
          <EventCard event={item} onSubscribe={handleSubscribe} />
        )}
        keyExtractor={item => item.id}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 40,
  },
  card: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  description: {
    marginVertical: 8,
  },
  subscribeButton: {
    alignSelf: 'flex-end',
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#4C8BF5',
  }
});