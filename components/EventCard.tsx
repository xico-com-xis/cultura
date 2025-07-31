import { format } from 'date-fns';
import { useRouter } from 'expo-router';
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import { eventTypeIcons } from '@/constants/EventTypes';
import { Event } from '@/context/EventsContext';
import { useColorScheme } from '@/hooks/useColorScheme';

type EventCardProps = {
  event: Event;
};

export default function EventCard({ event }: EventCardProps) {
  const router = useRouter();
  const colorScheme = useColorScheme();
  
  // Format the first date in the schedule
  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return format(date, 'MMM d, yyyy • h:mm a');
    } catch (error) {
      return dateStr;
    }
  };
  
  const navigateToEventDetails = () => {
    console.log('EventCard - Navigating to event detail with ID:', event.id, 'Type:', typeof event.id);
    console.log('EventCard - Event title:', event.title);
    router.push({
      pathname: '/event/[id]',
      params: { id: event.id }
    });
  };
  
  return (
    <TouchableOpacity 
      style={[
        styles.card, 
        { backgroundColor: Colors[colorScheme ?? 'light'].background }
      ]}
      onPress={navigateToEventDetails}
      activeOpacity={0.7}
    >
      {event.image ? (
        <Image 
          source={{ uri: event.image }} 
          style={styles.image}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.imagePlaceholder, { backgroundColor: Colors[colorScheme ?? 'light'].tabIconDefault }]}>
          <ThemedText style={styles.imagePlaceholderText}>{eventTypeIcons[event.type]}</ThemedText>
        </View>
      )}
      
      <View style={styles.info}>
        <View style={styles.typeContainer}>
          <ThemedText style={styles.type}>{eventTypeIcons[event.type]} {event.type}</ThemedText>
        </View>
        
        <ThemedText type="title" style={styles.title} numberOfLines={2}>{event.title}</ThemedText>
        
        <ThemedText style={styles.date} numberOfLines={1}>
          {event.schedule && event.schedule.length > 0 
            ? formatDate(event.schedule[0].date)
            : 'Date TBA'}
        </ThemedText>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.2)',
  },
  image: {
    width: '100%',
    height: 160,
  },
  imagePlaceholder: {
    width: '100%',
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholderText: {
    fontSize: 42,
  },
  info: {
    padding: 16,
  },
  typeContainer: {
    marginBottom: 8,
  },
  type: {
    fontSize: 14,
    textTransform: 'capitalize',
    opacity: 0.8,
  },
  title: {
    fontSize: 18,
    marginBottom: 8,
  },
  date: {
    fontSize: 14,
    marginBottom: 4,
  }
});