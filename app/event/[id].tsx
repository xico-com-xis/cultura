import { format } from 'date-fns';
import * as Clipboard from 'expo-clipboard';
import * as Notifications from 'expo-notifications';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState, useCallback } from 'react';
import { Alert, Dimensions, Linking, Modal, Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

import { CachedImage } from '@/components/CachedImage';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { eventTypeIcons } from '@/constants/EventTypes';
import { useAuth } from '@/context/AuthContext';
import { AccessibilityFeature, useEvents } from '@/context/EventsContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Stack } from 'expo-router';

const { width: screenWidth } = Dimensions.get('window');

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
    filteredEvents,
    loading, 
    favoriteEvent,
    unfavoriteEvent,
    isEventFavorited,
    isGlobalNotificationEnabled
  } = useEvents();
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  
  // State for image modal
  const [isImageModalVisible, setIsImageModalVisible] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  
  // State for navigation feedback  
  const [navigationDirection, setNavigationDirection] = useState<'forward' | 'backward' | null>(null);
  
  // Ref for modal ScrollView
  const modalScrollRef = useRef<ScrollView>(null);
  
  // Effect to scroll to selected image when modal opens
  useEffect(() => {
    if (isImageModalVisible && modalScrollRef.current) {
      // Small delay to ensure the modal is fully rendered
      setTimeout(() => {
        modalScrollRef.current?.scrollTo({
          x: selectedImageIndex * screenWidth,
          y: 0,
          animated: false,
        });
      }, 100);
    }
  }, [isImageModalVisible, selectedImageIndex]);
  
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
        pathname: '/profile/[id]',
        params: { 
          id: event.organizer.id
        }
      });
    }
  };

  const navigateToParticipant = (participantId: string) => {
    router.push({
      pathname: '/profile/[id]',
      params: { 
        id: participantId
      }
    });
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
        // When favoriting an event, check if user has notification settings enabled
        // and request permissions if needed
        const hasNotificationsEnabled = isGlobalNotificationEnabled('reminders') || 
                                       isGlobalNotificationEnabled('updates') || 
                                       isGlobalNotificationEnabled('changes');
        
        if (hasNotificationsEnabled) {
          await checkAndRequestNotificationPermissions();
        }
        
        await favoriteEvent(eventId);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update favorite status');
    }
  };

  const checkAndRequestNotificationPermissions = async (): Promise<boolean> => {
    try {
      // First check current permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      
      if (existingStatus === 'granted') {
        return true;
      }
      
      // If not granted, request permissions
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
      
      if (status === 'granted') {
        return true;
      }
      
      // Handle different denial scenarios
      if (status === 'denied') {
        Alert.alert(
          'Notifications Disabled',
          'You have notification settings enabled but notifications are disabled. To receive event notifications, please enable notifications in your device settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Open Settings', 
              onPress: () => {
                Alert.alert(
                  'Enable Notifications',
                  'Go to Settings > Notifications > Cultura and enable notifications.',
                  [{ text: 'OK' }]
                );
              }
            }
          ]
        );
      } else {
        Alert.alert(
          'Notification Permission Required',
          'You have notification settings enabled but we need permission to send notifications.',
          [{ text: 'OK' }]
        );
      }
      
      return false;
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return false;
    }
  };

  // Navigation functions for next/previous events - use the same filtered events as the events tab
  const navigateToNextEvent = () => {
    const currentIndex = filteredEvents.findIndex(e => String(e.id) === eventId);
    if (currentIndex !== -1 && currentIndex < filteredEvents.length - 1) {
      const nextEvent = filteredEvents[currentIndex + 1];
      
      setNavigationDirection('forward');
      setTimeout(() => setNavigationDirection(null), 300);
      
      router.replace({
        pathname: '/event/[id]',
        params: { id: nextEvent.id }
      });
    }
  };

  const navigateToPreviousEvent = () => {
    const currentIndex = filteredEvents.findIndex(e => String(e.id) === eventId);
    if (currentIndex > 0) {
      const previousEvent = filteredEvents[currentIndex - 1];
      
      setNavigationDirection('backward');
      setTimeout(() => setNavigationDirection(null), 300);
      
      router.replace({
        pathname: '/event/[id]',
        params: { id: previousEvent.id }
      });
    }
  };

  // Check if navigation is possible using the same filtered events as the events tab
  const currentIndex = filteredEvents.findIndex(e => String(e.id) === eventId);
  const canNavigateNext = currentIndex !== -1 && currentIndex < filteredEvents.length - 1;
  const canNavigatePrevious = currentIndex > 0;

  const addToCalendar = async () => {
    try {
      // Check if event has valid schedule
      if (!event.schedule || event.schedule.length === 0 || !event.schedule[0] || !event.schedule[0].date) {
        Alert.alert('Error', 'This event does not have a valid date to add to calendar.');
        return;
      }
      
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

  const shareEvent = async () => {
    try {
      // Format the event date
      const eventDate = event.schedule && event.schedule.length > 0 && event.schedule[0] && event.schedule[0].date
        ? format(new Date(event.schedule[0].date), 'EEEE, MMMM d, yyyy • h:mm a')
        : 'Date TBA';

      // Create the message
      const shareMessage = `Check out this event: ${event.title}

📅 ${eventDate}
📍 ${getLocationDisplay()}

Find more events on the Cultura app!`;

      // Copy to clipboard
      await Clipboard.setStringAsync(shareMessage);
      
      Alert.alert(
        'Event Copied!',
        'Event details have been copied to your clipboard. You can now paste and share it anywhere!',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Share error:', error);
      Alert.alert('Error', 'Unable to copy event details');
    }
  };
  
  return (
    <>
      <Stack.Screen 
        options={{ 
          headerShown: false,
          animation: 'none', // Disable default navigation animation
        }} 
      />
      <View style={styles.container}>
      {/* Header */}
      <ThemedView style={styles.header}>
        <View style={styles.headerLeftSection}>
          <TouchableOpacity 
            style={styles.headerBackButton}
            onPress={() => router.back()}
          >
            <IconSymbol name="chevron.left" size={24} color={Colors[colorScheme ?? 'light'].tint} />
          </TouchableOpacity>
        </View>
        <ThemedText style={styles.headerTitle}>Event Details</ThemedText>
        <View style={styles.headerRightSection}>
          <View style={styles.navigationButtons}>
            <TouchableOpacity 
              style={[
                styles.navigationButton,
                !canNavigatePrevious && styles.navigationButtonDisabled,
                navigationDirection === 'backward' && styles.navigationButtonActive
              ]}
              onPress={navigateToPreviousEvent}
              disabled={!canNavigatePrevious}
            >
              <IconSymbol 
                name="chevron.left" 
                size={18} 
                color={canNavigatePrevious ? Colors[colorScheme ?? 'light'].tint : "#C7C7CC"} 
              />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[
                styles.navigationButton,
                !canNavigateNext && styles.navigationButtonDisabled,
                navigationDirection === 'forward' && styles.navigationButtonActive
              ]}
              onPress={navigateToNextEvent}
              disabled={!canNavigateNext}
            >
              <IconSymbol 
                name="chevron.right" 
                size={18} 
                color={canNavigateNext ? Colors[colorScheme ?? 'light'].tint : "#C7C7CC"} 
              />
            </TouchableOpacity>
          </View>
          <TouchableOpacity 
            style={styles.shareButton}
            onPress={shareEvent}
          >
            <IconSymbol name="square.and.arrow.up" size={18} color={Colors[colorScheme ?? 'light'].tint} />
          </TouchableOpacity>
        </View>
      </ThemedView>

      {/* Content container */}
      <View style={styles.animatedContent}>
        <ScrollView style={styles.scrollView}>        
        {event.images && event.images.length > 0 ? (
          <View style={styles.imageGallery}>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              pagingEnabled
              style={styles.imageScrollView}
              onScroll={(event) => {
                const scrollPosition = event.nativeEvent.contentOffset.x;
                const index = Math.round(scrollPosition / screenWidth);
                setCurrentImageIndex(index);
              }}
              scrollEventThrottle={16}
            >
              {event.images.map((imageUri, index) => (
                <TouchableOpacity 
                  key={index}
                  onPress={() => {
                    setSelectedImageIndex(index);
                    setIsImageModalVisible(true);
                  }}
                >
                  <CachedImage 
                    source={{ uri: imageUri }} 
                    style={[styles.image, { width: screenWidth }]}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
            {event.images.length > 1 && (
              <View style={styles.imageIndicator}>
                {event.images.map((_, index) => (
                  <View 
                    key={index} 
                    style={[
                      styles.indicatorDot,
                      { backgroundColor: index === currentImageIndex ? Colors[colorScheme ?? 'light'].tint : 'rgba(255,255,255,0.5)' }
                    ]} 
                  />
                ))}
              </View>
            )}
          </View>
        ) : (
          <View style={styles.imagePlaceholder}>
            <ThemedText style={styles.imagePlaceholderText}>No Image</ThemedText>
          </View>
        )}
        
        <View style={styles.content}>
          <View style={styles.titleSection}>
            <View style={styles.titleContainer}>
              <ThemedText type="title" style={styles.title}>{event.title}</ThemedText>
              <View style={styles.typeContainer}>
                <ThemedText style={styles.typeText}>
                  {eventTypeIcons[event.type]} {event.type}
                </ThemedText>
              </View>
            </View>
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
            <View style={styles.sectionHeader}>
              <IconSymbol name="text.alignleft" size={20} color={Colors[colorScheme ?? 'light'].tint} />
              <ThemedText style={styles.sectionTitle}>About</ThemedText>
            </View>
            
            {/* Location */}
            <View style={styles.aboutItem}>
              <TouchableOpacity onPress={navigateToMap} disabled={!event.coordinates} style={styles.aboutClickableItem}>
                <View style={styles.iconContainer}>
                  <IconSymbol name="mappin" size={18} color={Colors[colorScheme ?? 'light'].tint} />
                </View>
                <ThemedText 
                  style={[
                    styles.aboutItemContent, 
                    event.coordinates && styles.clickableText
                  ]}
                >
                  {getLocationDisplay()}
                </ThemedText>
              </TouchableOpacity>
            </View>

            {/* Schedule */}
            <View style={styles.aboutItem}>
              <View style={styles.aboutClickableItem}>
                <TouchableOpacity style={styles.iconContainer} onPress={addToCalendar}>
                  <IconSymbol name="calendar" size={18} color={Colors[colorScheme ?? 'light'].tint} />
                </TouchableOpacity>
                <ThemedText style={styles.aboutItemContent}>
                  {formatRecurringEvent(event.schedule)}
                </ThemedText>
                {event.schedule.length > 1 && (
                  <View style={styles.recurringBadge}>
                    <IconSymbol name="repeat" size={10} color={Colors[colorScheme ?? 'light'].tint} />
                    <ThemedText style={styles.recurringText}>Recurring</ThemedText>
                  </View>
                )}
              </View>
            </View>

            {/* Duration */}
            <View style={styles.aboutItem}>
              <View style={styles.aboutClickableItem}>
                <View style={styles.iconContainer}>
                  <IconSymbol name="clock" size={18} color={Colors[colorScheme ?? 'light'].tint} />
                </View>
                <ThemedText style={styles.aboutItemContent}>
                  {event.durationMinutes === null || event.durationMinutes === undefined
                    ? 'Open-ended duration'
                    : event.durationMinutes < 60 
                      ? `${event.durationMinutes} minutes`
                      : `${Math.floor(event.durationMinutes / 60)}h ${event.durationMinutes % 60}m`
                  }
                </ThemedText>
              </View>
            </View>

            {/* Participation Type */}
            {event.participationType && (
              <View style={styles.aboutItem}>
                <View style={styles.aboutClickableItem}>
                  <View style={styles.iconContainer}>
                    <IconSymbol 
                      name={event.participationType === 'active' ? "person.fill" : "eye.fill"} 
                      size={18} 
                      color={Colors[colorScheme ?? 'light'].tint} 
                    />
                  </View>
                  <ThemedText style={styles.aboutItemContent}>
                    {event.participationType === 'active' 
                      ? 'Active participation - Join and engage with the event'
                      : 'Audience participation - Watch and enjoy the event'
                    }
                  </ThemedText>
                </View>
              </View>
            )}

            {/* Description */}
            <View style={styles.aboutItem}>
              <ThemedText style={styles.sectionContent}>{event.description}</ThemedText>
            </View>
          </ThemedView>
          
          <ThemedView style={styles.section}>
            <View style={styles.sectionHeader}>
              <IconSymbol name="person.circle" size={20} color={Colors[colorScheme ?? 'light'].tint} />
              <ThemedText style={styles.sectionTitle}>Organizer</ThemedText>
            </View>
            <TouchableOpacity onPress={navigateToOrganizer} style={styles.organizerCard}>
              <View style={styles.organizerInfo}>
                <IconSymbol name="person.circle.fill" size={32} color={Colors[colorScheme ?? 'light'].tint} />
                <ThemedText style={[styles.sectionContent, styles.clickableText, { marginLeft: 12 }]}>
                  {event.organizer.name}
                </ThemedText>
              </View>
              <IconSymbol name="chevron.right" size={16} color="#C7C7CC" />
            </TouchableOpacity>
          </ThemedView>

          {event.participants && event.participants.length > 0 && (
            <ThemedView style={styles.section}>
              <View style={styles.sectionHeader}>
                <IconSymbol name="person.2" size={20} color={Colors[colorScheme ?? 'light'].tint} />
                <ThemedText style={styles.sectionTitle}>
                  Participants ({event.participants.length})
                </ThemedText>
              </View>
              <View style={styles.participantsContainer}>
                {event.participants.map((participant, index) => (
                  <TouchableOpacity 
                    key={participant.id}
                    onPress={() => navigateToParticipant(participant.id)}
                    style={styles.participantItem}
                  >
                    <View style={styles.participantInfo}>
                      <IconSymbol name="person.circle.fill" size={24} color={Colors[colorScheme ?? 'light'].tint} />
                      <ThemedText 
                        style={[styles.sectionContent, styles.clickableText, { marginLeft: 12 }]}
                      >
                        {participant.name}
                      </ThemedText>
                    </View>
                    <IconSymbol name="chevron.right" size={16} color="#C7C7CC" />
                  </TouchableOpacity>
                ))}
              </View>
            </ThemedView>
          )}
          
          {event.professionals && event.professionals.length > 0 && (
            <ThemedView style={styles.section}>
              <View style={styles.sectionHeader}>
                <IconSymbol name="person.badge.shield.checkmark" size={20} color={Colors[colorScheme ?? 'light'].tint} />
                <ThemedText style={styles.sectionTitle}>Featured Professionals</ThemedText>
              </View>
              <View style={styles.professionalsContainer}>
                {event.professionals.map((professional, index) => (
                  <View key={index} style={styles.professionalItem}>
                    <IconSymbol name="star.fill" size={16} color="#FFD700" />
                    <ThemedText style={[styles.sectionContent, { marginLeft: 8 }]}>{professional}</ThemedText>
                  </View>
                ))}
              </View>
            </ThemedView>
          )}
          
          {event.accessibility && event.accessibility.length > 0 && (
            <ThemedView style={styles.section}>
              <View style={styles.sectionHeader}>
                <IconSymbol name="accessibility" size={20} color={Colors[colorScheme ?? 'light'].tint} />
                <ThemedText style={styles.sectionTitle}>Accessibility</ThemedText>
              </View>
              <View style={styles.accessibilityContainer}>
                {event.accessibility.map((feature, index) => (
                  <View key={index} style={styles.accessibilityItem}>
                    <ThemedText style={styles.accessibilityIcon}>{accessibilityIcons[feature]}</ThemedText>
                    <ThemedText style={[styles.sectionContent, { textTransform: 'capitalize' }]}>{feature}</ThemedText>
                  </View>
                ))}
              </View>
            </ThemedView>
          )}
          
          <ThemedView style={styles.section}>
            <View style={styles.sectionHeader}>
              <IconSymbol name="ticket" size={20} color={Colors[colorScheme ?? 'light'].tint} />
              <ThemedText style={styles.sectionTitle}>Ticket Information</ThemedText>
            </View>
            <ThemedText style={styles.sectionContent}>
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

      {/* Full Screen Image Modal */}
      <Modal
        visible={isImageModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsImageModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          {/* Background area that closes modal when tapped */}
          <Pressable 
            style={styles.modalBackground}
            onPress={() => setIsImageModalVisible(false)}
          />
          
          {/* Image content area that doesn't close modal */}
          <View style={styles.modalContainer}>
            {event.images && event.images.length > 0 && (
              <ScrollView
                ref={modalScrollRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                style={styles.modalImageScrollView}
                onMomentumScrollEnd={(event) => {
                  const scrollPosition = event.nativeEvent.contentOffset.x;
                  const index = Math.round(scrollPosition / screenWidth);
                  setSelectedImageIndex(index);
                }}
              >
                {event.images.map((imageUri, index) => (
                  <View key={index} style={styles.modalImageContainer}>
                    <CachedImage 
                      source={{ uri: imageUri }} 
                      style={styles.fullScreenImage}
                      resizeMode="contain"
                    />
                  </View>
                ))}
              </ScrollView>
            )}
            
            {/* Image counter and navigation */}
            {event.images && event.images.length > 1 && (
              <View style={styles.modalImageInfo}>
                <ThemedText style={styles.imageCounter}>
                  {selectedImageIndex + 1} of {event.images.length}
                </ThemedText>
                <View style={styles.modalImageIndicator}>
                  {event.images.map((_, index) => (
                    <View 
                      key={index} 
                      style={[
                        styles.modalIndicatorDot,
                        { backgroundColor: index === selectedImageIndex ? '#FFFFFF' : 'rgba(255,255,255,0.5)' }
                      ]} 
                    />
                  ))}
                </View>
              </View>
            )}
            
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => setIsImageModalVisible(false)}
            >
              <IconSymbol name="xmark" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  animatedContent: {
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
    backgroundColor: '#ffffff',
  },
  headerBackButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerLeftSection: {
    width: 80,
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  headerRightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 80,
    justifyContent: 'flex-end',
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
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    lineHeight: 34,
  },
  titleSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 32,
  },
  titleContainer: {
    flex: 1,
  },
  typeContainer: {
    marginTop: 8,
  },
  typeText: {
    fontSize: 14,
    color: '#666',
    textTransform: 'capitalize',
    fontWeight: '500',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 12,
    flex: 1,
  },
  sectionContent: {
    fontSize: 16,
    lineHeight: 22,
    color: '#333',
  },
  aboutItem: {
    marginBottom: 16,
  },
  aboutClickableItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 26,
    height: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  aboutItemContent: {
    fontSize: 16,
    lineHeight: 22,
    color: '#333',
    flex: 1,
  },
  clickableText: {
    color: Colors.light.tint,
    textDecorationLine: 'underline',
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
  organizerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
  },
  organizerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  clickableOrganizer: {
    color: '#007AFF', // iOS blue color to indicate it's clickable
    textDecorationLine: 'underline',
  },
  professional: {
    marginBottom: 4,
  },
  professionalsContainer: {
    marginTop: 8,
  },
  professionalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    marginBottom: 8,
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
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
  },
  accessibilityIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  accessibilityLabel: {
    textTransform: 'capitalize',
  },
  ticketInfo: {
    marginBottom: 12,
  },
  button: {
    backgroundColor: Colors.light.tint,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
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
    borderColor: Colors.light.tint,
  },
  favoriteButtonActive: {
    backgroundColor: Colors.light.tint,
    borderColor: Colors.light.tint,
  },
  followButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.light.tint,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginLeft: 12,
  },
  followButtonActive: {
    backgroundColor: Colors.light.tint,
    borderColor: Colors.light.tint,
  },
  followButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.tint,
  },
  followButtonTextActive: {
    color: '#FFFFFF',
  },
  recurringBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F5FF',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
    marginLeft: 8,
  },
  recurringText: {
    fontSize: 10,
    color: Colors.light.tint,
    fontWeight: '500',
    marginLeft: 2,
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
  navigationButtonActive: {
    backgroundColor: 'rgba(10, 126, 164, 0.3)',
    transform: [{ scale: 1.1 }],
  },
  shareButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    backgroundColor: '#F2F2F7',
  },
  participantsContainer: {
    marginTop: 8,
  },
  participantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    marginBottom: 8,
  },
  participantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  participantName: {
    fontSize: 16,
    marginLeft: 12,
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  modalBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  fullScreenImage: {
    width: 350,
    height: 500,
    borderRadius: 8,
  },
  closeButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  // Image gallery styles
  imageGallery: {
    position: 'relative',
  },
  imageScrollView: {
    height: 250,
  },
  imageIndicator: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  indicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  // Modal image navigation styles
  modalImageScrollView: {
    width: screenWidth,
    height: '100%',
  },
  modalImageContainer: {
    width: screenWidth,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImageInfo: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  imageCounter: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 12,
  },
  modalImageIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  modalIndicatorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});