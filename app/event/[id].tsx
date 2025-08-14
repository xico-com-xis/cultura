import { format } from 'date-fns';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Image, Linking, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { eventTypeIcons } from '@/constants/EventTypes';
import { useAuth } from '@/context/AuthContext';
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
  const { 
    events, 
    loading, 
    favoriteEvent,
    unfavoriteEvent,
    isEventFavorited,
    isGlobalNotificationEnabled
  } = useEvents();
  const { user } = useAuth();
  
  // Convert id to string to ensure proper comparison
  const eventId = String(id);
  const event = events.find(e => String(e.id) === eventId);
  
  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>Loading event...</ThemedText>
      </ThemedView>
    );
  }

  if (!event) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>Event not found</ThemedText>
        <ThemedText>Looking for ID: {id}</ThemedText>
      </ThemedView>
    );
  }  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return format(date, 'EEEE, MMMM d, yyyy • h:mm a');
    } catch (error) {
      return dateStr;
    }
  };

  // Format recurring event display
  const formatRecurringEvent = (schedule: { date: string; endDate?: string }[]) => {
    if (schedule.length <= 1) {
      return formatDate(schedule[0].date);
    }

    // Get start and end dates
    const dates = schedule.map(s => new Date(s.date)).sort((a, b) => a.getTime() - b.getTime());
    const startDate = dates[0];
    const endDate = dates[dates.length - 1];

    // Get unique days of the week and sort them
    const dayNumbers = [...new Set(dates.map(date => date.getDay()))].sort();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const daysText = dayNumbers.map(dayNum => dayNames[dayNum]).join(', ');

    // Format time from first occurrence
    const timeText = format(startDate, 'h:mm a');

    return `${format(startDate, 'MMMM d')} - ${format(endDate, 'MMMM d, yyyy')}\n${daysText}s at ${timeText}`;
  };

  const navigateToMap = () => {
    if (event.coordinates) {
      router.push({
        pathname: '/(tabs)/map',
        params: { 
          latitude: event.coordinates.latitude.toString(),
          longitude: event.coordinates.longitude.toString(),
          eventId: event.id,
          eventTitle: event.title
        }
      });
    }
  };

  const navigateToOrganizer = () => {
    if (event.organizer.id) {
      router.push({
        pathname: '/organizer/[id]',
        params: { 
          id: event.organizer.id
        }
      });
    }
  };

  const getLocationDisplay = () => {
    if (event.location && event.location.trim()) {
      return `${event.location.trim()}, ${event.city}`;
    }
    return event.city;
  };

  const handleFavoriteToggle = async () => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to favorite events');
      return;
    }

    try {
      if (isEventFavorited(eventId)) {
        await unfavoriteEvent(eventId);
      } else {
        await favoriteEvent(eventId);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update favorite status');
    }
  };

  // Navigation functions for next/previous events (only future events)
  const navigateToNextEvent = () => {
    // Filter to only future events (events that haven't started yet)
    const now = new Date();
    const futureEvents = events.filter(event => {
      const eventDate = new Date(event.schedule[0].date);
      return eventDate > now;
    });
    
    const currentIndex = futureEvents.findIndex(e => String(e.id) === eventId);
    if (currentIndex !== -1 && currentIndex < futureEvents.length - 1) {
      const nextEvent = futureEvents[currentIndex + 1];
      router.replace({
        pathname: '/event/[id]',
        params: { id: nextEvent.id }
      });
    }
  };

  const navigateToPreviousEvent = () => {
    // Filter to only future events (events that haven't started yet)
    const now = new Date();
    const futureEvents = events.filter(event => {
      const eventDate = new Date(event.schedule[0].date);
      return eventDate > now;
    });
    
    const currentIndex = futureEvents.findIndex(e => String(e.id) === eventId);
    if (currentIndex > 0) {
      const previousEvent = futureEvents[currentIndex - 1];
      router.replace({
        pathname: '/event/[id]',
        params: { id: previousEvent.id }
      });
    }
  };

  // Check if navigation is possible (only among future events)
  const now = new Date();
  const futureEvents = events.filter(event => {
    const eventDate = new Date(event.schedule[0].date);
    return eventDate > now;
  });
  const currentIndex = futureEvents.findIndex(e => String(e.id) === eventId);
  const canNavigateNext = currentIndex !== -1 && currentIndex < futureEvents.length - 1;
  const canNavigatePrevious = currentIndex > 0;

  const addToCalendar = async () => {
    try {
      // Get the first occurrence date for single events or the start date for recurring events
      const firstDate = new Date(event.schedule[0].date);
      const endDate = event.schedule[0].endDate ? new Date(event.schedule[0].endDate) : new Date(firstDate.getTime() + 60 * 60 * 1000); // Default 1 hour duration
      
      // Format dates for calendar URL
      const formatCalendarDate = (date: Date) => {
        return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      };

      const startTime = formatCalendarDate(firstDate);
      const endTime = formatCalendarDate(endDate);
      
      // Encode event details for URLs
      const title = encodeURIComponent(event.title);
      const description = encodeURIComponent(`${event.description}\n\nOrganized by: ${event.organizer.name}`);
      const location = encodeURIComponent(getLocationDisplay());
      
      let calendarOpened = false;

      // For iOS, go directly to Google Calendar web version which works reliably
      const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startTime}/${endTime}&details=${description}&location=${location}`;
      
      const supported = await Linking.canOpenURL(googleCalendarUrl);
      
      if (supported) {
        await Linking.openURL(googleCalendarUrl);
        calendarOpened = true;
      }

      // Try Android Calendar app with pre-filled details
      if (!calendarOpened) {
        try {
          const androidCalendarUrl = `content://com.android.calendar/time/${firstDate.getTime()}?title=${title}&description=${description}&eventLocation=${location}&beginTime=${firstDate.getTime()}&endTime=${endDate.getTime()}`;
          const androidSupported = await Linking.canOpenURL(androidCalendarUrl);
          
          if (androidSupported) {
            await Linking.openURL(androidCalendarUrl);
            calendarOpened = true;
          }
        } catch (error) {
          console.log('Android calendar failed:', error);
        }
      }

      // Try Outlook mobile with pre-filled details
      if (!calendarOpened) {
        try {
          const outlookUrl = `ms-outlook://calendar/newevent?subject=${title}&startdt=${startTime}&enddt=${endTime}&location=${location}&body=${description}`;
          const outlookSupported = await Linking.canOpenURL(outlookUrl);
          
          if (outlookSupported) {
            await Linking.openURL(outlookUrl);
            calendarOpened = true;
          }
        } catch (error) {
          console.log('Outlook failed:', error);
        }
      }

      // Final fallback - show manual instructions
      if (!calendarOpened) {
        Alert.alert(
          'Add to Calendar',
          'Unable to open calendar app. Please add the event manually:\n\n' +
          `Title: ${event.title}\n` +
          `Date: ${format(firstDate, 'EEEE, MMMM d, yyyy • h:mm a')}\n` +
          `Location: ${getLocationDisplay()}\n` +
          `Description: ${event.description}`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Calendar error:', error);
      Alert.alert('Error', 'Unable to add event to calendar');
    }
  };
  
  return (
    <View style={styles.container}>
      {/* Header */}
      <ThemedView style={styles.header}>
        <TouchableOpacity 
          style={styles.headerBackButton}
          onPress={() => router.back()}
        >
          <IconSymbol name="chevron.left" size={24} color="#007AFF" />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>Event Details</ThemedText>
        <View style={styles.headerRightSection}>
          <View style={styles.navigationButtons}>
            <TouchableOpacity 
              style={[
                styles.navigationButton,
                !canNavigatePrevious && styles.navigationButtonDisabled
              ]}
              onPress={navigateToPreviousEvent}
              disabled={!canNavigatePrevious}
            >
              <IconSymbol 
                name="chevron.left" 
                size={18} 
                color={canNavigatePrevious ? "#007AFF" : "#C7C7CC"} 
              />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[
                styles.navigationButton,
                !canNavigateNext && styles.navigationButtonDisabled
              ]}
              onPress={navigateToNextEvent}
              disabled={!canNavigateNext}
            >
              <IconSymbol 
                name="chevron.right" 
                size={18} 
                color={canNavigateNext ? "#007AFF" : "#C7C7CC"} 
              />
            </TouchableOpacity>
          </View>
        </View>
      </ThemedView>

      <ScrollView style={styles.scrollView}>        
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
        
        <View style={styles.content}>
          <View style={styles.titleSection}>
            <ThemedText type="title" style={styles.title}>{event.title}</ThemedText>
            {user && (
              <TouchableOpacity 
                style={[
                  styles.followButton, 
                  isEventFavorited(eventId) && styles.followButtonActive
                ]}
                onPress={handleFavoriteToggle}
              >
                <ThemedText style={[
                  styles.followButtonText,
                  isEventFavorited(eventId) && styles.followButtonTextActive
                ]}>
                  {isEventFavorited(eventId) ? 'Following' : 'Follow'}
                </ThemedText>
              </TouchableOpacity>
            )}
          </View>
          
          <ThemedView style={styles.section}>
            <IconSymbol name="mappin" size={20} color="#808080" />
            <TouchableOpacity onPress={navigateToMap} disabled={!event.coordinates}>
              <ThemedText 
                style={[
                  styles.location, 
                  event.coordinates && styles.clickableLocation
                ]}
              >
                {getLocationDisplay()}
              </ThemedText>
            </TouchableOpacity>
          </ThemedView>
          
          <ThemedView style={styles.section}>
            <View style={styles.calendarHeader}>
              <TouchableOpacity style={styles.calendarIconButton} onPress={addToCalendar}>
                <IconSymbol name="calendar" size={20} color="#4C8BF5" />
              </TouchableOpacity>
              {event.schedule.length > 1 && (
                <View style={styles.recurringBadge}>
                  <IconSymbol name="repeat" size={12} color="#4C8BF5" />
                  <ThemedText style={styles.recurringText}>Recurring</ThemedText>
                </View>
              )}
            </View>
            <ThemedText style={styles.scheduleItem}>
              {formatRecurringEvent(event.schedule)}
            </ThemedText>
          </ThemedView>

          <ThemedText style={styles.type}>
            {eventTypeIcons[event.type]} {event.type}
          </ThemedText>
          
          <ThemedView style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Organizer</ThemedText>
            <TouchableOpacity onPress={navigateToOrganizer}>
              <ThemedText 
                style={[styles.organizer, styles.clickableOrganizer]}
              >
                {event.organizer.name}
              </ThemedText>
            </TouchableOpacity>
          </ThemedView>
          
          <ThemedView style={styles.section}>
            <ThemedText style={styles.sectionTitle}>About</ThemedText>
            <ThemedText style={styles.description}>{event.description}</ThemedText>
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
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 50,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#ffffff',
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
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  backButton: {
    position: 'absolute',
    top: 50, // Positioned relative to the padded container
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
    backgroundColor: '#ffffff', // Ensure white background
  },
  title: {
    fontSize: 24,
    marginBottom: 8,
    flex: 1,
  },
  titleSection: {
    flexDirection: 'row',
    alignItems: 'center',
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
  clickableLocation: {
    color: '#007AFF', // iOS blue color to indicate it's clickable
    textDecorationLine: 'underline',
  },
  description: {
    lineHeight: 22,
  },
  organizer: {},
  clickableOrganizer: {
    color: '#007AFF', // iOS blue color to indicate it's clickable
    textDecorationLine: 'underline',
  },
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
  favoriteButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#4C8BF5',
  },
  favoriteButtonActive: {
    backgroundColor: '#4C8BF5',
    borderColor: '#4C8BF5',
  },
  followButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#4C8BF5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginLeft: 12,
  },
  followButtonActive: {
    backgroundColor: '#4C8BF5',
    borderColor: '#4C8BF5',
  },
  followButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4C8BF5',
  },
  followButtonTextActive: {
    color: '#FFFFFF',
  },
  recurringBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F5FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  recurringText: {
    fontSize: 11,
    color: '#4C8BF5',
    fontWeight: '500',
    marginLeft: 3,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  calendarIconButton: {
    padding: 4,
    marginRight: 8,
    borderRadius: 6,
  },
  headerRightSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  navigationButtons: {
    flexDirection: 'row',
    marginLeft: 8,
  },
  navigationButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
    backgroundColor: '#F2F2F7',
  },
  navigationButtonDisabled: {
    backgroundColor: '#F9F9F9',
  },
});