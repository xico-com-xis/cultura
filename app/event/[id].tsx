import { format } from 'date-fns';
import { router, useLocalSearchParams } from 'expo-router';
import { Image, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { AccessibilityFeature, useEvents } from '@/context/EventsContext';

const accessibilityIcons: Record<AccessibilityFeature, string> = {
  wheelchair: '♿',
  hearing: '👂',
  visual: '👁️',
  parking: '🅿️',
  restroom: '🚻',
  seating: '💺'
};

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams();
  const { events } = useEvents();
  
  const event = events.find(e => e.id === id);
  
  if (!event) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>Event not found</ThemedText>
      </ThemedView>
    );
  }
  
  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return format(date, 'EEEE, MMMM d, yyyy • h:mm a');
    } catch (error) {
      return dateStr;
    }
  };
  
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <IconSymbol name="chevron.left" size={24} color="#fff" />
        </TouchableOpacity>
        
        {event.image ? (
          <Image 
            source={{ uri: event.image }} 
            style={styles.image}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <ThemedText style={styles.imagePlaceholderText}>No Image</ThemedText>
          </View>
        )}
        
        <ThemedView style={styles.content}>
          <ThemedText type="title" style={styles.title}>{event.title}</ThemedText>
          
          <ThemedText style={styles.type}>{event.type}</ThemedText>
          
          <ThemedView style={styles.section}>
            <IconSymbol name="calendar" size={20} color="#808080" />
            {event.schedule.map((schedule, index) => (
              <ThemedText key={index} style={styles.scheduleItem}>
                {formatDate(schedule.date)}
                {schedule.endDate && ` - ${format(new Date(schedule.endDate), 'h:mm a')}`}
              </ThemedText>
            ))}
          </ThemedView>
          
          <ThemedView style={styles.section}>
            <IconSymbol name="mappin" size={20} color="#808080" />
            <ThemedText style={styles.location}>{event.location}</ThemedText>
          </ThemedView>
          
          <ThemedView style={styles.section}>
            <ThemedText style={styles.sectionTitle}>About</ThemedText>
            <ThemedText style={styles.description}>{event.description}</ThemedText>
          </ThemedView>
          
          <ThemedView style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Organizer</ThemedText>
            <ThemedText style={styles.organizer}>{event.organizer.name}</ThemedText>
          </ThemedView>
          
          {event.professionals && event.professionals.length > 0 && (
            <ThemedView style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Featured Professionals</ThemedText>
              {event.professionals.map((professional, index) => (
                <ThemedText key={index} style={styles.professional}>{professional}</ThemedText>
              ))}
            </ThemedView>
          )}
          
          {event.accessibility && event.accessibility.length > 0 && (
            <ThemedView style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Accessibility</ThemedText>
              <View style={styles.accessibilityContainer}>
                {event.accessibility.map((feature, index) => (
                  <View key={index} style={styles.accessibilityItem}>
                    <ThemedText style={styles.accessibilityIcon}>{accessibilityIcons[feature]}</ThemedText>
                    <ThemedText style={styles.accessibilityLabel}>{feature}</ThemedText>
                  </View>
                ))}
              </View>
            </ThemedView>
          )}
          
          <ThemedView style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Ticket Information</ThemedText>
            <ThemedText style={styles.ticketInfo}>
              {event.ticketInfo.type === 'free' 
                ? 'Free admission' 
                : event.ticketInfo.type === 'donation' 
                  ? 'Admission by donation'
                  : `${event.ticketInfo.price} ${event.ticketInfo.currency}`}
            </ThemedText>
            {event.ticketInfo.purchaseLink && (
              <TouchableOpacity style={styles.button}>
                <ThemedText style={styles.buttonText}>Buy Tickets</ThemedText>
              </TouchableOpacity>
            )}
          </ThemedView>
        </ThemedView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  backButton: {
    position: 'absolute',
    top: 16,
    left: 16,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: 250,
  },
  imagePlaceholder: {
    width: '100%',
    height: 250,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholderText: {
    fontSize: 18,
    color: '#666',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    marginBottom: 8,
  },
  type: {
    fontSize: 16,
    opacity: 0.7,
    textTransform: 'capitalize',
    marginBottom: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  scheduleItem: {
    marginTop: 4,
  },
  location: {
    marginTop: 4,
  },
  description: {
    lineHeight: 22,
  },
  organizer: {},
  professional: {
    marginBottom: 4,
  },
  accessibilityContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  accessibilityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 8,
  },
  accessibilityIcon: {
    fontSize: 18,
    marginRight: 4,
  },
  accessibilityLabel: {
    textTransform: 'capitalize',
  },
  ticketInfo: {
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#4C8BF5',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
  },
});