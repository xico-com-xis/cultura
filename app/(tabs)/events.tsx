import { router } from 'expo-router';
import { FlatList, StyleSheet, TouchableOpacity } from 'react-native';

import EventCard from '@/components/EventCard';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useEvents } from '@/context/EventContext';

export default function EventsScreen() {
  const { events } = useEvents();
  
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
          <EventCard event={item} />
        )}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
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
  listContent: {
    paddingBottom: 20,
  }
});