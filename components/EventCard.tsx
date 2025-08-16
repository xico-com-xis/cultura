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
      return `${format(date, 'MMM d, yyyy')}\n${format(date, 'h:mm a')}`;
    } catch (error) {
      return dateStr;
    }
  };

  // Format recurring event display
  const formatRecurringEvent = (schedule: { date: string; endDate?: string }[]) => {
    if (!schedule || schedule.length === 0) {
      return 'Date TBA';
    }
    
    if (schedule.length <= 1) {
      if (!schedule[0] || !schedule[0].date) {
        return 'Date TBA';
      }
      return formatDate(schedule[0].date);
    }

    // Get start and end dates
    const dates = schedule
      .filter(s => s && s.date) // Filter out null/undefined entries
      .map(s => new Date(s.date))
      .sort((a, b) => a.getTime() - b.getTime());
    
    if (dates.length === 0) {
      return 'Date TBA';
    }
    
    const startDate = dates[0];
    const endDate = dates[dates.length - 1];

    // Get unique days of the week and sort them
    const dayNumbers = [...new Set(dates.map(date => date.getDay()))].sort();
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const daysText = dayNumbers.map(dayNum => dayNames[dayNum]).join(', ');

    // Format time from first occurrence
    const timeText = format(startDate, 'h:mm a');

    return `${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d, yyyy')}\n${daysText} at ${timeText}`;
  };
  
  const navigateToEventDetails = () => {
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
        
        <ThemedText style={styles.date} numberOfLines={2}>
          {event.schedule && event.schedule.length > 0 
            ? formatRecurringEvent(event.schedule)
            : 'Date TBA'}
        </ThemedText>
        
        {/* Participants display */}
        {event.participants && event.participants.length > 0 && (
          <View style={styles.participantsContainer}>
            <ThemedText style={styles.participantsLabel}>👥 Participants: </ThemedText>
            <ThemedText style={styles.participantsText} numberOfLines={1}>
              {event.participants.map(p => p.name).join(', ')}
            </ThemedText>
          </View>
        )}
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
  },
  participantsContainer: {
    flexDirection: 'row',
    marginTop: 4,
    alignItems: 'center',
  },
  participantsLabel: {
    fontSize: 12,
    opacity: 0.8,
    fontWeight: '600',
  },
  participantsText: {
    fontSize: 12,
    opacity: 0.7,
    flex: 1,
  },
});