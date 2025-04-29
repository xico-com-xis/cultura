import { StyleSheet } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useState, useEffect } from 'react';

import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';

// Sample event data - replace with your API call
const SAMPLE_EVENTS = [
  { id: 1, title: 'Art Exhibition', location: { latitude: 37.78825, longitude: -122.4324 } },
  { id: 2, title: 'Music Festival', location: { latitude: 37.79025, longitude: -122.4124 } },
  { id: 3, title: 'Cultural Workshop', location: { latitude: 37.78225, longitude: -122.4524 } },
];

export default function MapScreen() {
  const [events, setEvents] = useState(SAMPLE_EVENTS);
  const [selectedEvent, setSelectedEvent] = useState(null);

  return (
    <ThemedView style={styles.container}>
      <MapView style={styles.map} initialRegion={{
        latitude: 37.78825,
        longitude: -122.4324,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      }}>
        {events.map(event => (
          <Marker
            key={event.id}
            coordinate={event.location}
            title={event.title}
            onPress={() => setSelectedEvent(event)}
          />
        ))}
      </MapView>
      
      {selectedEvent && (
        <ThemedView style={styles.eventCard}>
          <ThemedText type="title">{selectedEvent.title}</ThemedText>
          <ThemedText>Location: {selectedEvent.location.latitude}, {selectedEvent.location.longitude}</ThemedText>
        </ThemedView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  eventCard: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    padding: 15,
    borderRadius: 10,
  }
});