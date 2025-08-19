import DateTimePicker from '@react-native-community/datetimepicker';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

import ImagePickerComponent from '@/components/ImagePickerComponent';
import LocationPicker from '@/components/LocationPicker';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import UserSearchInput from '@/components/UserSearchInput';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthContext';
import { Event, EventType, Organizer, TicketInfo, useEvents } from '@/context/EventsContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Coordinates, createFullAddress, geocodeAddress, getCityDefaultCoordinates } from '@/utils/geocoding';
import { uploadImageToSupabase } from '@/utils/imageUpload';

interface EditEventFormProps {
  event: Event;
  onClose: () => void;
  onEventUpdated?: () => void;
}

// Event type options with emoji icons
const eventTypeOptions: Array<{ type: EventType; label: string; icon: string }> = [
  { type: 'music', label: 'Music', icon: '🎵' },
  { type: 'art', label: 'Art', icon: '🎨' },
  { type: 'theater', label: 'Theater', icon: '🎭' },
  { type: 'dance', label: 'Dance', icon: '💃' },
  { type: 'workshop', label: 'Workshop', icon: '🛠️' },
  { type: 'festival', label: 'Festival', icon: '🎪' },
  { type: 'exhibition', label: 'Exhibition', icon: '🖼️' },
  { type: 'film', label: 'Film', icon: '🎬' },
  { type: 'literature', label: 'Literature', icon: '📚' },
  { type: 'other', label: 'Other', icon: '🔖' }
];

// Weekdays for recurring events (Sunday = 0, Monday = 1, etc.)
const weekdays = [
  { day: 1, label: 'Mon', fullName: 'Monday' },
  { day: 2, label: 'Tue', fullName: 'Tuesday' },
  { day: 3, label: 'Wed', fullName: 'Wednesday' },
  { day: 4, label: 'Thu', fullName: 'Thursday' },
  { day: 5, label: 'Fri', fullName: 'Friday' },
  { day: 6, label: 'Sat', fullName: 'Saturday' },
  { day: 0, label: 'Sun', fullName: 'Sunday' }
];

export default function EditEventForm({ event, onClose, onEventUpdated }: EditEventFormProps) {
  const colorScheme = useColorScheme();
  const { updateEvent, filters, availableCities } = useEvents();
  const { user } = useAuth();

  // Form state - initialize with event data
  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description);
  const [selectedType, setSelectedType] = useState<EventType>(event.type);
  const [location, setLocation] = useState(event.location);
  const [selectedCity, setSelectedCity] = useState(event.city);
  const [localImageUri, setLocalImageUri] = useState((event.images && event.images.length > 0 ? event.images[0] : '') || ''); // Store local image URI
  const [uploadedImageUrl, setUploadedImageUrl] = useState((event.images && event.images.length > 0 ? event.images[0] : '') || ''); // Store uploaded URL
  const [selectedParticipants, setSelectedParticipants] = useState<Organizer[]>(event.participants || []); // Tagged participants
  
  // Location state - initialize with event coordinates
  const [coordinates, setCoordinates] = useState<Coordinates | null>(event.coordinates || null);
  const [isGeocodingLoading, setIsGeocodingLoading] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showLocationInput, setShowLocationInput] = useState(!!event.location);
  
  // Date/time state - initialize with first event date
  const [eventDate, setEventDate] = useState(() => {
    const firstSchedule = event.schedule[0];
    return firstSchedule ? new Date(firstSchedule.date) : new Date();
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<'date' | 'time'>('date');
  
  // Recurring events state - determine if event is recurring and set up accordingly
  const [isRecurring, setIsRecurring] = useState(() => {
    return event.schedule.length > 1;
  });
  const [selectedWeekdays, setSelectedWeekdays] = useState<Set<number>>(() => {
    if (event.schedule.length > 1) {
      // Extract weekdays from schedule
      const weekdaysSet = new Set<number>();
      event.schedule.forEach(schedule => {
        const date = new Date(schedule.date);
        weekdaysSet.add(date.getDay());
      });
      return weekdaysSet;
    }
    return new Set();
  });
  const [recurringEndDate, setRecurringEndDate] = useState(() => {
    if (event.schedule.length > 1) {
      // Use the last date from the schedule
      const lastSchedule = event.schedule[event.schedule.length - 1];
      return new Date(lastSchedule.date);
    } else {
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 3); // Default 3 months from now
      return endDate;
    }
  });
  const [showRecurringEndDatePicker, setShowRecurringEndDatePicker] = useState(false);
  
  // Ticket info state - initialize with event ticket info
  const [ticketType, setTicketType] = useState<'free' | 'paid' | 'donation'>(event.ticketInfo?.type || 'free');
  const [ticketPrice, setTicketPrice] = useState(event.ticketInfo?.price?.toString() || '');
  const [purchaseLink, setPurchaseLink] = useState(event.ticketInfo?.purchaseLink || '');
  
  // Participation type and duration state - initialize with event data
  const [participationType, setParticipationType] = useState<'active' | 'audience'>(event.participationType || 'audience');
  const [durationHours, setDurationHours] = useState(() => {
    if (event.durationMinutes === null || event.durationMinutes === undefined) return '';
    return Math.floor(event.durationMinutes / 60).toString();
  });
  const [durationMinutes, setDurationMinutes] = useState(() => {
    if (event.durationMinutes === null || event.durationMinutes === undefined) return '';
    return (event.durationMinutes % 60).toString();
  });
  const [isUndefinedDuration, setIsUndefinedDuration] = useState(() => {
    return event.durationMinutes === null || event.durationMinutes === undefined;
  });

  // Auto-geocode when location and city are both filled
  useEffect(() => {
    const autoGeocode = async () => {
      // Only auto-geocode if we don't already have coordinates and both fields are filled
      if (!coordinates && location.trim() && selectedCity && filters.selectedCountry && !isGeocodingLoading && showLocationInput) {
        try {
          setIsGeocodingLoading(true);
          const fullAddress = createFullAddress(location.trim(), selectedCity, filters.selectedCountry);
          console.log('Auto-geocoding:', fullAddress);
          
          const geocodedCoords = await geocodeAddress(fullAddress);
          if (geocodedCoords) {
            setCoordinates(geocodedCoords);
            console.log('Auto-geocoding successful:', geocodedCoords);
          } else {
            console.log('Auto-geocoding failed, will need manual selection');
          }
        } catch (error) {
          console.error('Auto-geocoding error:', error);
        } finally {
          setIsGeocodingLoading(false);
        }
      }
    };

    // Debounce the geocoding by 1 second to avoid too many requests
    const timeoutId = setTimeout(autoGeocode, 1000);
    return () => clearTimeout(timeoutId);
  }, [location, selectedCity, filters.selectedCountry, coordinates, isGeocodingLoading, showLocationInput]);

  // Calculate total duration in minutes
  const getTotalDurationMinutes = () => {
    if (isUndefinedDuration) {
      return null; // Return null for undefined duration
    }
    const hours = parseInt(durationHours) || 0;
    const minutes = parseInt(durationMinutes) || 0;
    return hours * 60 + minutes;
  };

  // Validation and submission
  const isFormValid = () => {
    const baseValid = title.trim() !== '' && 
           description.trim() !== '' && 
           selectedCity !== '' &&
           coordinates !== null && // Precise location is now mandatory
           localImageUri.trim() !== '' && // Local image is now mandatory
           (isUndefinedDuration || durationHours.trim() !== '' || durationMinutes.trim() !== ''); // Duration is mandatory unless undefined
    
    // For editing, allow events to start in the past (existing events)
    // but new future dates still need the 8-hour rule
    const now = new Date();
    const originalFirstDate = new Date(event.schedule[0]?.date || 0);
    const isDateChanged = Math.abs(eventDate.getTime() - originalFirstDate.getTime()) > 60000; // More than 1 minute difference
    
    if (isDateChanged && eventDate > now) {
      // If date is changed and in the future, apply the 8-hour rule
      const minimumStartTime = new Date(now.getTime() + 8 * 60 * 60 * 1000); // 8 hours from now
      const eventStartsInTime = eventDate >= minimumStartTime;
      
      if (isRecurring) {
        return baseValid && selectedWeekdays.size > 0 && eventStartsInTime;
      }
      
      return baseValid && eventStartsInTime;
    }
    
    // If date is not changed or is in the past, don't apply time restriction
    if (isRecurring) {
      return baseValid && selectedWeekdays.size > 0;
    }
    
    return baseValid;
  };

  const getMinimumDateTime = () => {
    const now = new Date();
    const originalFirstDate = new Date(event.schedule[0]?.date || 0);
    const isDateChanged = Math.abs(eventDate.getTime() - originalFirstDate.getTime()) > 60000; // More than 1 minute difference
    
    if (isDateChanged && eventDate > now) {
      return new Date(now.getTime() + 8 * 60 * 60 * 1000); // 8 hours from now for changed future dates
    }
    
    return new Date(0); // No restriction for existing dates or past dates
  };

  // Generate recurring event dates
  const generateRecurringDates = () => {
    if (!isRecurring || selectedWeekdays.size === 0) {
      // Non-recurring event: only include start time
      return [{
        date: eventDate.toISOString(),
      }];
    }

    // Recurring events: only use start time, no end time per occurrence
    const dates = [];
    const startDate = new Date(eventDate);
    const endDate = new Date(recurringEndDate);
    const currentDate = new Date(startDate);

    // Set currentDate to the start of the week containing eventDate
    currentDate.setDate(startDate.getDate() - startDate.getDay());

    while (currentDate <= endDate) {
      for (const weekday of selectedWeekdays) {
        const eventDateForWeekday = new Date(currentDate);
        eventDateForWeekday.setDate(currentDate.getDate() + weekday);
        eventDateForWeekday.setHours(startDate.getHours());
        eventDateForWeekday.setMinutes(startDate.getMinutes());

        // Only include dates that are >= startDate and <= endDate
        if (eventDateForWeekday >= startDate && eventDateForWeekday <= endDate) {
          dates.push({
            date: eventDateForWeekday.toISOString(),
          });
        }
      }
      // Move to next week
      currentDate.setDate(currentDate.getDate() + 7);
    }

    return dates.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  const toggleWeekday = (day: number) => {
    const newSelected = new Set(selectedWeekdays);
    if (newSelected.has(day)) {
      newSelected.delete(day);
    } else {
      newSelected.add(day);
    }
    setSelectedWeekdays(newSelected);
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!isFormValid()) {
      let errorMessage = 'Please fill in all required fields';
      const now = new Date();
      const originalFirstDate = new Date(event.schedule[0]?.date || 0);
      const isDateChanged = Math.abs(eventDate.getTime() - originalFirstDate.getTime()) > 60000;
      
      if (!coordinates) {
        errorMessage = 'Please set a precise location using "Find Address" or "Pick on Map" buttons.';
      } else if (!localImageUri.trim()) {
        errorMessage = 'Please add an image for your event.';
      } else if (!isUndefinedDuration && durationHours.trim() === '' && durationMinutes.trim() === '') {
        errorMessage = 'Please specify the duration of your event or mark it as undefined.';
      } else if (isDateChanged && eventDate > now && eventDate < new Date(now.getTime() + 8 * 60 * 60 * 1000)) {
        errorMessage = 'New future event times must start at least 8 hours from now to give people time to discover and plan.';
      } else if (isRecurring && selectedWeekdays.size === 0) {
        errorMessage = 'Please select at least one day of the week for recurring events.';
      }
      Alert.alert('Error', errorMessage);
      return;
    }

    if (!user) {
      Alert.alert('Error', 'You must be logged in to edit events');
      return;
    }

    if (isSubmitting) {
      return; // Prevent double submission
    }

    setIsSubmitting(true);

    try {
      // Upload image first if we have a local image that's different from the existing one
      let finalImageUrl = uploadedImageUrl; // Use existing uploaded URL if available
      
      if (localImageUri && localImageUri !== (event.images && event.images.length > 0 ? event.images[0] : '') && !finalImageUrl) {
        try {
          setUploadProgress('Uploading image...');
          const uploadResult = await uploadImageToSupabase(localImageUri, user.id, title.trim());
          if (uploadResult.success && uploadResult.url) {
            finalImageUrl = uploadResult.url;
            setUploadedImageUrl(uploadResult.url); // Store the uploaded URL
            setUploadProgress('Updating event...');
          } else {
            throw new Error(uploadResult.error || 'Image upload failed');
          }
        } catch (uploadError) {
          console.error('Image upload error:', uploadError);
          
          // Provide more specific error messages based on the error type
          let errorMessage = 'Failed to upload image. Please try again.';
          if (uploadError instanceof Error) {
            if (uploadError.message.includes('timeout')) {
              errorMessage = 'Image upload timed out. Please check your internet connection or try a smaller image.';
            } else if (uploadError.message.includes('Network request timed out')) {
              errorMessage = 'Network timeout. Please check your internet connection and try again.';
            } else if (uploadError.message.includes('policy')) {
              errorMessage = 'Permission error. Please contact support.';
            }
          }
          
          Alert.alert(
            'Upload Error', 
            errorMessage,
            [{ text: 'OK' }]
          );
          return;
        }
      }

      // Prepare ticket info
      const ticketInfo: TicketInfo = {
        type: ticketType,
        ...(ticketType === 'paid' && ticketPrice && {
          price: parseFloat(ticketPrice),
          currency: 'EUR',
          purchaseLink: purchaseLink || undefined,
          onSiteAvailable: true,
        }),
      };

      // Try to get coordinates for the event
      let eventCoordinates = coordinates;
      
      // If no coordinates from map picker, try geocoding
      if (!eventCoordinates && location.trim() && selectedCity && filters.selectedCountry) {
        try {
          setUploadProgress('Finding location...');
          setIsGeocodingLoading(true);
          const fullAddress = createFullAddress(location.trim(), selectedCity, filters.selectedCountry);
          console.log('Attempting to geocode:', fullAddress);
          eventCoordinates = await geocodeAddress(fullAddress);
          
          if (eventCoordinates) {
            console.log('Geocoding successful:', eventCoordinates);
          } else {
            console.log('Geocoding failed, using city default');
            eventCoordinates = getCityDefaultCoordinates(selectedCity);
          }
        } catch (error) {
          console.error('Geocoding error:', error);
          eventCoordinates = getCityDefaultCoordinates(selectedCity);
        } finally {
          setIsGeocodingLoading(false);
          setUploadProgress('Updating event...');
        }
      }
      
      // Fallback to city coordinates if no specific location
      if (!eventCoordinates) {
        eventCoordinates = getCityDefaultCoordinates(selectedCity);
      }

      setUploadProgress('Updating event...');

      // Create the updated event
      const updatedEvent = {
        ...event, // Keep existing event data
        title: title.trim(),
        type: selectedType,
        schedule: generateRecurringDates(),
        location: location.trim(),
        city: selectedCity,
        country: filters.selectedCountry,
        description: description.trim(),
        participants: selectedParticipants, // Include tagged participants
        participationType, // Include participation type
        durationMinutes: getTotalDurationMinutes(), // Include duration in minutes
        ticketInfo,
        coordinates: eventCoordinates || undefined, // Convert null to undefined for type compatibility
        images: finalImageUrl ? [finalImageUrl] : undefined, // Include the uploaded image URL as array
      };

      await updateEvent(event.id, updatedEvent);
      
      Alert.alert(
        'Success!', 
        'Your event has been updated successfully!',
        [
          {
            text: 'OK',
            onPress: () => {
              onEventUpdated?.();
              onClose();
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error updating event:', error);
      Alert.alert(
        'Error', 
        'Failed to update event. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsSubmitting(false);
      setUploadProgress(null);
    }
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    const currentDate = selectedDate || eventDate;
    
    // Android always closes after selection
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
      if (event.type === 'set') {
        if (datePickerMode === 'date') {
          const newDate = new Date(eventDate);
          newDate.setFullYear(currentDate.getFullYear());
          newDate.setMonth(currentDate.getMonth());
          newDate.setDate(currentDate.getDate());
          setEventDate(newDate);
        } else {
          const newDate = new Date(eventDate);
          newDate.setHours(currentDate.getHours());
          newDate.setMinutes(currentDate.getMinutes());
          setEventDate(newDate);
        }
      }
      return;
    }
    
    // iOS handling - only close on dismiss
    if (event.type === 'dismissed') {
      setShowDatePicker(false);
      setDatePickerMode('date');
    } else {
      // For all other events on iOS, just update the value and keep open
      if (datePickerMode === 'date') {
        const newDate = new Date(eventDate);
        newDate.setFullYear(currentDate.getFullYear());
        newDate.setMonth(currentDate.getMonth());
        newDate.setDate(currentDate.getDate());
        setEventDate(newDate);
      } else if (datePickerMode === 'time') {
        const newDate = new Date(eventDate);
        newDate.setHours(currentDate.getHours());
        newDate.setMinutes(currentDate.getMinutes());
        setEventDate(newDate);
      }
    }
  };

  const onRecurringEndDateChange = (event: any, selectedDate?: Date) => {
    const currentDate = selectedDate || recurringEndDate;
    
    // Android always closes after selection
    if (Platform.OS === 'android') {
      setShowRecurringEndDatePicker(false);
      if (event.type === 'set') {
        setRecurringEndDate(currentDate);
      }
      return;
    }
    
    // iOS handling - only close on dismiss
    if (event.type === 'dismissed') {
      setShowRecurringEndDatePicker(false);
    } else {
      // For all other events on iOS, just update the value and keep open
      setRecurringEndDate(currentDate);
    }
  };

  // Location-related functions
  const handleGeocode = async () => {
    // Show location input if not already shown
    if (!showLocationInput) {
      setShowLocationInput(true);
      return;
    }

    if (!location.trim() || !selectedCity || !filters.selectedCountry) {
      Alert.alert(
        'Missing Information',
        'Please fill in the venue/location address first.'
      );
      return;
    }

    setIsGeocodingLoading(true);
    try {
      const fullAddress = createFullAddress(location.trim(), selectedCity, filters.selectedCountry);
      console.log('Manual geocoding request for:', fullAddress);
      
      const geocodedCoords = await geocodeAddress(fullAddress);
      if (geocodedCoords) {
        setCoordinates(geocodedCoords);
        Alert.alert(
          'Location Found!',
          `Successfully found coordinates for your address.`,
          [{ text: 'OK' }]
        );
      } else {
        const cityCoords = getCityDefaultCoordinates(selectedCity);
        if (cityCoords) {
          setCoordinates(cityCoords);
          Alert.alert(
            'Using City Center',
            `Could not find exact address. Using ${selectedCity} city center instead.`,
            [{ text: 'OK' }]
          );
        } else {
          Alert.alert(
            'Geocoding Failed',
            'Could not find coordinates for this address. You can try "Pick on Map" instead.'
          );
        }
      }
    } catch (error) {
      console.error('Manual geocoding error:', error);
      Alert.alert('Error', 'Failed to geocode address. Please try again.');
    } finally {
      setIsGeocodingLoading(false);
    }
  };

  const handleLocationPicked = (pickedCoordinates: Coordinates) => {
    setCoordinates(pickedCoordinates);
    console.log('Location picked from map:', pickedCoordinates);
  };

  const clearLocation = () => {
    setCoordinates(null);
    setLocation('');
    setShowLocationInput(false);
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.headerContainer}>
          <ThemedText style={styles.headerTitle}>Edit Event</ThemedText>
          <ThemedText style={styles.headerSubtitle}>
            Update your event details below
          </ThemedText>
        </View>

        {/* Title Input */}
        <View style={styles.inputContainer}>
          <ThemedText style={styles.label}>Event Title *</ThemedText>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: Colors[colorScheme ?? 'light'].background,
                borderColor: Colors[colorScheme ?? 'light'].text + '30',
                color: Colors[colorScheme ?? 'light'].text,
              },
            ]}
            placeholder="Enter event title"
            placeholderTextColor={Colors[colorScheme ?? 'light'].text + '70'}
            value={title}
            onChangeText={setTitle}
            maxLength={100}
          />
        </View>

        {/* Event Type Selection */}
        <View style={styles.inputContainer}>
          <ThemedText style={styles.label}>Event Type *</ThemedText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeScrollView}>
            <View style={styles.typeOptionsContainer}>
              {eventTypeOptions.map((option) => (
                <TouchableOpacity
                  key={option.type}
                  style={[
                    styles.typeOption,
                    selectedType === option.type && {
                      backgroundColor: Colors[colorScheme ?? 'light'].tint,
                      borderColor: Colors[colorScheme ?? 'light'].tint,
                    },
                  ]}
                  onPress={() => setSelectedType(option.type)}
                >
                  <ThemedText
                    style={[
                      styles.typeOptionText,
                      selectedType === option.type && { color: '#fff' },
                    ]}
                  >
                    {option.icon} {option.label}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Description Input */}
        <View style={styles.inputContainer}>
          <ThemedText style={styles.label}>Description *</ThemedText>
          <TextInput
            style={[
              styles.textArea,
              {
                backgroundColor: Colors[colorScheme ?? 'light'].background,
                borderColor: Colors[colorScheme ?? 'light'].text + '30',
                color: Colors[colorScheme ?? 'light'].text,
              },
            ]}
            placeholder="Describe your event..."
            placeholderTextColor={Colors[colorScheme ?? 'light'].text + '70'}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            maxLength={500}
          />
        </View>

        {/* Participants Search */}
        <View style={styles.inputContainer}>
          <ThemedText style={styles.label}>Tag Participants</ThemedText>
          <ThemedText style={styles.sublabel}>Search and tag other users as participants in your event</ThemedText>
          <UserSearchInput
            selectedUsers={selectedParticipants}
            onUsersChange={setSelectedParticipants}
            placeholder="Search users to tag as participants..."
          />
        </View>

        {/* Image Upload */}
        {user && (
          <View style={styles.inputContainer}>
            <ThemedText style={styles.label}>Event Image *</ThemedText>
            <ImagePickerComponent
              onImageSelected={setLocalImageUri}
              currentImageUrl={localImageUri}
              userId={user.id}
              eventTitle={title}
              allowRemove={true}
              skipUpload={true}
            />
          </View>
        )}

        {/* City Selection */}
        <View style={styles.inputContainer}>
          <ThemedText style={styles.label}>City *</ThemedText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeScrollView}>
            <View style={styles.typeOptionsContainer}>
              {availableCities.map((city) => (
                <TouchableOpacity
                  key={city}
                  style={[
                    styles.typeOption,
                    selectedCity === city && {
                      backgroundColor: Colors[colorScheme ?? 'light'].tint,
                      borderColor: Colors[colorScheme ?? 'light'].tint,
                    },
                  ]}
                  onPress={() => setSelectedCity(city)}
                >
                  <ThemedText
                    style={[
                      styles.typeOptionText,
                      selectedCity === city && { color: '#fff' },
                    ]}
                  >
                    📍 {city}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Location Selection Options */}
        <View style={styles.inputContainer}>
          <ThemedText style={styles.label}>Precise Location *</ThemedText>
          <ThemedText style={styles.sublabel}>
            Required: Choose the exact location for your event
          </ThemedText>
          
          <View style={styles.locationOptionsContainer}>
            {/* Find Address / Geocode Button */}
            <TouchableOpacity
              style={[
                styles.locationButton,
                isGeocodingLoading && styles.locationButtonDisabled,
                {
                  backgroundColor: showLocationInput 
                    ? Colors[colorScheme ?? 'light'].tint 
                    : Colors[colorScheme ?? 'light'].background,
                  borderColor: Colors[colorScheme ?? 'light'].tint,
                },
              ]}
              onPress={handleGeocode}
              disabled={isGeocodingLoading}
            >
              {isGeocodingLoading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <IconSymbol 
                  name="location" 
                  size={20} 
                  color={showLocationInput ? "white" : Colors[colorScheme ?? 'light'].tint} 
                />
              )}
              <ThemedText style={[
                styles.locationButtonText, 
                { 
                  color: showLocationInput 
                    ? "white" 
                    : Colors[colorScheme ?? 'light'].tint 
                }
              ]}>
                {isGeocodingLoading 
                  ? 'Finding...' 
                  : showLocationInput 
                    ? 'Find Address' 
                    : 'Enter Address'
                }
              </ThemedText>
            </TouchableOpacity>

            {/* Map Picker Button */}
            <TouchableOpacity
              style={[
                styles.locationButton,
                {
                  backgroundColor: Colors[colorScheme ?? 'light'].background,
                  borderColor: Colors[colorScheme ?? 'light'].tint,
                },
              ]}
              onPress={() => setShowLocationPicker(true)}
            >
              <IconSymbol name="map" size={20} color={Colors[colorScheme ?? 'light'].tint} />
              <ThemedText style={[styles.locationButtonText, { color: Colors[colorScheme ?? 'light'].tint }]}>
                Pick on Map
              </ThemedText>
            </TouchableOpacity>
          </View>

          {/* Venue/Location Input - Shows when Find Address is clicked */}
          {showLocationInput && (
            <View style={styles.locationInputContainer}>
              <ThemedText style={styles.locationInputLabel}>Venue/Location Address *</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: Colors[colorScheme ?? 'light'].background,
                    borderColor: Colors[colorScheme ?? 'light'].text + '30',
                    color: Colors[colorScheme ?? 'light'].text,
                  },
                ]}
                placeholder="Enter venue name and address"
                placeholderTextColor={Colors[colorScheme ?? 'light'].text + '70'}
                value={location}
                onChangeText={setLocation}
                maxLength={200}
              />
            </View>
          )}

          {/* Selected Location Display */}
          {coordinates ? (
            <View style={styles.selectedLocationContainer}>
              <View style={styles.selectedLocationInfo}>
                <IconSymbol name="checkmark.circle" size={16} color={Colors[colorScheme ?? 'light'].tint} />
                <ThemedText style={styles.selectedLocationText}>
                  📍 Location set: {coordinates.latitude.toFixed(4)}, {coordinates.longitude.toFixed(4)}
                </ThemedText>
              </View>
              <TouchableOpacity onPress={clearLocation} style={styles.clearLocationButton}>
                <IconSymbol name="xmark" size={14} color={Colors[colorScheme ?? 'light'].text + '70'} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.warningLocationContainer}>
              <IconSymbol name="exclamationmark.triangle" size={16} color="#ff9500" />
              <ThemedText style={styles.warningLocationText}>
                ⚠️ Please set a precise location using one of the options above
              </ThemedText>
            </View>
          )}
        </View>

        {/* Date and Time */}
        <View style={styles.inputContainer}>
          <ThemedText style={styles.label}>Date & Time *</ThemedText>
          <View style={styles.dateTimeRow}>
            <TouchableOpacity
              style={[
                styles.dateButton,
                styles.dateButtonHalf,
                {
                  borderColor: Colors[colorScheme ?? 'light'].text + '30',
                },
              ]}
              onPress={() => {
                setDatePickerMode('date');
                setShowDatePicker(true);
              }}
            >
              <IconSymbol name="calendar" size={18} color={Colors[colorScheme ?? 'light'].text} />
              <ThemedText style={styles.dateButtonTextSmall}>
                {eventDate ? new Date(eventDate).toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'short', 
                  day: 'numeric' 
                }) : 'Select Date'}
              </ThemedText>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.dateButton,
                styles.dateButtonHalf,
                {
                  borderColor: Colors[colorScheme ?? 'light'].text + '30',
                },
              ]}
              onPress={() => {
                setDatePickerMode('time');
                setShowDatePicker(true);
              }}
            >
              <IconSymbol name="clock" size={18} color={Colors[colorScheme ?? 'light'].text} />
              <ThemedText style={styles.dateButtonTextSmall}>
                {eventDate ? new Date(eventDate).toLocaleTimeString('en-US', { 
                  hour: '2-digit', 
                  minute: '2-digit',
                  hour12: true 
                }) : 'Select Time'}
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recurring Events */}
        <View style={styles.inputContainer}>
          <ThemedText style={styles.label}>Recurring Event</ThemedText>
          <TouchableOpacity
            style={[
              styles.recurringToggle,
              isRecurring && {
                backgroundColor: Colors[colorScheme ?? 'light'].tint,
                borderColor: Colors[colorScheme ?? 'light'].tint,
              },
            ]}
            onPress={() => setIsRecurring(!isRecurring)}
          >
            <IconSymbol 
              name={isRecurring ? "checkmark.circle.fill" : "circle"} 
              size={20} 
              color={isRecurring ? "white" : Colors[colorScheme ?? 'light'].text + '70'} 
            />
            <ThemedText style={[
              styles.recurringToggleText,
              isRecurring && { color: 'white' }
            ]}>
              Repeat weekly on selected days
            </ThemedText>
          </TouchableOpacity>
          
          {isRecurring && (
            <View style={styles.recurringOptions}>
              <ThemedText style={styles.sublabel}>Select days of the week</ThemedText>
              <View style={styles.weekdaysContainer}>
                {weekdays.map((weekday) => (
                  <TouchableOpacity
                    key={weekday.day}
                    style={[
                      styles.weekdayButton,
                      selectedWeekdays.has(weekday.day) && {
                        backgroundColor: Colors[colorScheme ?? 'light'].tint,
                        borderColor: Colors[colorScheme ?? 'light'].tint,
                      },
                    ]}
                    onPress={() => toggleWeekday(weekday.day)}
                  >
                    <ThemedText style={[
                      styles.weekdayButtonText,
                      selectedWeekdays.has(weekday.day) && { color: 'white' }
                    ]}>
                      {weekday.label}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>
              
              <View style={styles.recurringEndDateContainer}>
                <ThemedText style={styles.sublabel}>End date for recurring events</ThemedText>
                <TouchableOpacity
                  style={[
                    styles.dateButton,
                    {
                      borderColor: Colors[colorScheme ?? 'light'].text + '30',
                    },
                  ]}
                  onPress={() => setShowRecurringEndDatePicker(true)}
                >
                  <IconSymbol name="calendar" size={18} color={Colors[colorScheme ?? 'light'].text} />
                  <ThemedText style={styles.dateButtonText}>
                    {recurringEndDate.toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'short', 
                      day: 'numeric' 
                    })}
                  </ThemedText>
                </TouchableOpacity>
                
                {selectedWeekdays.size > 0 && (
                  <ThemedText style={styles.recurringPreview}>
                    Will create {generateRecurringDates().length} events
                  </ThemedText>
                )}
              </View>
            </View>
          )}
        </View>

        {/* Participation Type */}
        <View style={styles.inputContainer}>
          <ThemedText style={styles.label}>Participation Type *</ThemedText>
          <ThemedText style={styles.sublabel}>What type of participation is expected?</ThemedText>
          <View style={styles.participationTypeContainer}>
            <TouchableOpacity
              style={[
                styles.participationTypeOption,
                participationType === 'active' && {
                  backgroundColor: Colors[colorScheme ?? 'light'].tint,
                  borderColor: Colors[colorScheme ?? 'light'].tint,
                },
              ]}
              onPress={() => setParticipationType('active')}
            >
              <ThemedText
                style={[
                  styles.participationTypeText,
                  participationType === 'active' && { color: '#fff' },
                ]}
              >
                👥 Active Participation
              </ThemedText>
              <ThemedText
                style={[
                  styles.participationTypeSubtext,
                  participationType === 'active' && { color: '#fff' },
                ]}
              >
                Attendees join and engage with the event
              </ThemedText>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.participationTypeOption,
                participationType === 'audience' && {
                  backgroundColor: Colors[colorScheme ?? 'light'].tint,
                  borderColor: Colors[colorScheme ?? 'light'].tint,
                },
              ]}
              onPress={() => setParticipationType('audience')}
            >
              <ThemedText
                style={[
                  styles.participationTypeText,
                  participationType === 'audience' && { color: '#fff' },
                ]}
              >
                👁️ Audience Participation
              </ThemedText>
              <ThemedText
                style={[
                  styles.participationTypeSubtext,
                  participationType === 'audience' && { color: '#fff' },
                ]}
              >
                Attendees watch and enjoy the event
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>

        {/* Duration */}
        <View style={styles.inputContainer}>
          <ThemedText style={styles.label}>Event Duration *</ThemedText>
          <ThemedText style={styles.sublabel}>How long will your event last?</ThemedText>
          
          {/* Undefined duration checkbox */}
          <TouchableOpacity
            style={styles.checkboxContainer}
            onPress={() => {
              setIsUndefinedDuration(!isUndefinedDuration);
              if (!isUndefinedDuration) {
                // Clear duration inputs when marking as undefined
                setDurationHours('');
                setDurationMinutes('');
              }
            }}
          >
            <View style={[
              styles.checkbox,
              {
                borderColor: Colors[colorScheme ?? 'light'].text + '50',
                backgroundColor: isUndefinedDuration ? Colors[colorScheme ?? 'light'].tint : 'transparent',
              }
            ]}>
              {isUndefinedDuration && (
                <IconSymbol name="checkmark" size={16} color="white" />
              )}
            </View>
            <ThemedText style={styles.checkboxLabel}>
              Undefined duration (open-ended event)
            </ThemedText>
          </TouchableOpacity>
          
          {!isUndefinedDuration && (
            <View style={styles.durationContainer}>
              <View style={styles.durationInputGroup}>
                <TextInput
                  style={[
                    styles.durationInput,
                    {
                      backgroundColor: Colors[colorScheme ?? 'light'].background,
                      borderColor: Colors[colorScheme ?? 'light'].text + '30',
                      color: Colors[colorScheme ?? 'light'].text,
                    },
                  ]}
                  placeholder="0"
                  placeholderTextColor={Colors[colorScheme ?? 'light'].text + '70'}
                  value={durationHours}
                  onChangeText={setDurationHours}
                  keyboardType="numeric"
                  maxLength={2}
                />
                <ThemedText style={styles.durationLabel}>hours</ThemedText>
              </View>
              
              <View style={styles.durationInputGroup}>
                <TextInput
                  style={[
                    styles.durationInput,
                    {
                      backgroundColor: Colors[colorScheme ?? 'light'].background,
                      borderColor: Colors[colorScheme ?? 'light'].text + '30',
                      color: Colors[colorScheme ?? 'light'].text,
                    },
                  ]}
                  placeholder="0"
                  placeholderTextColor={Colors[colorScheme ?? 'light'].text + '70'}
                  value={durationMinutes}
                  onChangeText={(text) => {
                    // Limit minutes to 0-59
                    const minutes = parseInt(text) || 0;
                    if (minutes <= 59) {
                      setDurationMinutes(text);
                    }
                  }}
                  keyboardType="numeric"
                  maxLength={2}
                />
                <ThemedText style={styles.durationLabel}>minutes</ThemedText>
              </View>
            </View>
          )}
          
          {/* Duration preview */}
          {(durationHours.trim() !== '' || durationMinutes.trim() !== '') && !isUndefinedDuration && (
            <View style={styles.durationPreviewContainer}>
              <IconSymbol name="clock" size={14} color={Colors[colorScheme ?? 'light'].tint} />
              <ThemedText style={styles.durationPreviewText}>
                Total duration: {getTotalDurationMinutes()} minutes
                {getTotalDurationMinutes() && getTotalDurationMinutes()! >= 60 && ` (${Math.floor(getTotalDurationMinutes()! / 60)}h ${getTotalDurationMinutes()! % 60}m)`}
              </ThemedText>
            </View>
          )}
          
          {/* Undefined duration preview */}
          {isUndefinedDuration && (
            <View style={styles.durationPreviewContainer}>
              <IconSymbol name="clock" size={14} color={Colors[colorScheme ?? 'light'].tint} />
              <ThemedText style={styles.durationPreviewText}>
                Duration: Open-ended/Undefined
              </ThemedText>
            </View>
          )}
        </View>

        {/* Ticket Information */}
        <View style={styles.inputContainer}>
          <ThemedText style={styles.label}>Ticket Type *</ThemedText>
          <View style={styles.ticketTypeContainer}>
            {(['free', 'paid', 'donation'] as const).map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.ticketTypeOption,
                  ticketType === type && {
                    backgroundColor: Colors[colorScheme ?? 'light'].tint,
                    borderColor: Colors[colorScheme ?? 'light'].tint,
                  },
                ]}
                onPress={() => setTicketType(type)}
              >
                <ThemedText
                  style={[
                    styles.ticketTypeText,
                    ticketType === type && { color: '#fff' },
                  ]}
                >
                  {type === 'free' && '🆓 Free'}
                  {type === 'paid' && '💳 Paid'}
                  {type === 'donation' && '💝 Donation'}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Price input (if paid) */}
        {ticketType === 'paid' && (
          <>
            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>Price (EUR) *</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: Colors[colorScheme ?? 'light'].background,
                    borderColor: Colors[colorScheme ?? 'light'].text + '30',
                    color: Colors[colorScheme ?? 'light'].text,
                  },
                ]}
                placeholder="0.00"
                placeholderTextColor={Colors[colorScheme ?? 'light'].text + '70'}
                value={ticketPrice}
                onChangeText={setTicketPrice}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>Purchase Link (Optional)</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: Colors[colorScheme ?? 'light'].background,
                    borderColor: Colors[colorScheme ?? 'light'].text + '30',
                    color: Colors[colorScheme ?? 'light'].text,
                  },
                ]}
                placeholder="https://tickets.example.com"
                placeholderTextColor={Colors[colorScheme ?? 'light'].text + '70'}
                value={purchaseLink}
                onChangeText={setPurchaseLink}
                keyboardType="url"
                autoCapitalize="none"
              />
            </View>
          </>
        )}

        {/* Submit Button */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            {
              backgroundColor: (isFormValid() && !isSubmitting) 
                ? Colors[colorScheme ?? 'light'].tint 
                : Colors[colorScheme ?? 'light'].text + '30',
            },
          ]}
          onPress={handleSubmit}
          disabled={!isFormValid() || isSubmitting}
        >
          {isSubmitting ? (
            <View style={styles.submitButtonContent}>
              <ActivityIndicator size="small" color="#fff" style={styles.loadingIndicator} />
              <ThemedText style={styles.submitButtonText}>
                {uploadProgress || 'Updating Event...'}
              </ThemedText>
            </View>
          ) : (
            <ThemedText style={styles.submitButtonText}>Update Event</ThemedText>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Date Picker */}
      {showDatePicker && Platform.OS === 'ios' && (
        <Modal
          transparent={true}
          animationType="fade"
          visible={showDatePicker}
          onRequestClose={() => setShowDatePicker(false)}
        >
          <Pressable 
            style={styles.modalOverlay}
            onPress={() => {
              setShowDatePicker(false);
              setDatePickerMode('date'); // Reset for next time
            }}
          >
            <Pressable 
              style={[
                styles.pickerContainer,
                { backgroundColor: Colors[colorScheme ?? 'light'].background }
              ]} 
              onPress={(e) => e.stopPropagation()}
            >
              <DateTimePicker
                testID="dateTimePicker"
                value={eventDate}
                mode={datePickerMode}
                is24Hour={true}
                display="spinner"
                onChange={onDateChange}
                themeVariant={colorScheme ?? 'light'}
                textColor={Colors[colorScheme ?? 'light'].text}
                accentColor={Colors[colorScheme ?? 'light'].tint}
                minimumDate={getMinimumDateTime()}
                style={{
                  backgroundColor: Colors[colorScheme ?? 'light'].background,
                }}
              />
            </Pressable>
          </Pressable>
        </Modal>
      )}
      
      {/* Android Date Picker - uses default system picker */}
      {showDatePicker && Platform.OS === 'android' && (
        <DateTimePicker
          testID="dateTimePicker"
          value={eventDate}
          mode={datePickerMode}
          is24Hour={true}
          display="default"
          onChange={onDateChange}
          themeVariant={colorScheme ?? 'light'}
          textColor={Colors[colorScheme ?? 'light'].text}
          accentColor={Colors[colorScheme ?? 'light'].tint}
          minimumDate={getMinimumDateTime()}
        />
      )}
      
      {/* Location Picker */}
      <LocationPicker
        visible={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        onLocationSelect={handleLocationPicked}
        initialLocation={coordinates || undefined}
        city={selectedCity}
        country={filters.selectedCountry}
      />

      {/* Recurring End Date Picker */}
      {showRecurringEndDatePicker && Platform.OS === 'ios' && (
        <Modal
          transparent={true}
          animationType="fade"
          visible={showRecurringEndDatePicker}
          onRequestClose={() => setShowRecurringEndDatePicker(false)}
        >
          <Pressable 
            style={styles.modalOverlay}
            onPress={() => setShowRecurringEndDatePicker(false)}
          >
            <Pressable 
              style={[
                styles.pickerContainer,
                { backgroundColor: Colors[colorScheme ?? 'light'].background }
              ]} 
              onPress={(e) => e.stopPropagation()}
            >
              <DateTimePicker
                testID="recurringEndDatePicker"
                value={recurringEndDate}
                mode="date"
                is24Hour={true}
                display="spinner"
                onChange={onRecurringEndDateChange}
                themeVariant={colorScheme ?? 'light'}
                textColor={Colors[colorScheme ?? 'light'].text}
                accentColor={Colors[colorScheme ?? 'light'].tint}
                minimumDate={getMinimumDateTime()}
                style={{
                  backgroundColor: Colors[colorScheme ?? 'light'].background,
                }}
              />
            </Pressable>
          </Pressable>
        </Modal>
      )}
      
      {/* Android Recurring End Date Picker */}
      {showRecurringEndDatePicker && Platform.OS === 'android' && (
        <DateTimePicker
          testID="recurringEndDatePicker"
          value={recurringEndDate}
          mode="date"
          is24Hour={true}
          display="default"
          onChange={onRecurringEndDateChange}
          themeVariant={colorScheme ?? 'light'}
          textColor={Colors[colorScheme ?? 'light'].text}
          accentColor={Colors[colorScheme ?? 'light'].tint}
          minimumDate={getMinimumDateTime()}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  scrollView: {
    flex: 1,
  },
  headerContainer: {
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    opacity: 0.7,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 48,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  typeScrollView: {
    maxHeight: 120,
  },
  typeOptionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  typeOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    margin: 4,
  },
  typeOptionText: {
    fontSize: 14,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 8,
    gap: 8,
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dateButtonHalf: {
    flex: 1,
  },
  dateButtonTextSmall: {
    fontSize: 14,
  },
  dateButtonText: {
    fontSize: 16,
  },
  ticketTypeContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  ticketTypeOption: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    alignItems: 'center',
  },
  ticketTypeText: {
    fontSize: 14,
    fontWeight: '500',
  },
  submitButton: {
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  submitButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingIndicator: {
    marginRight: 8,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  sublabel: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 12,
    fontStyle: 'italic',
  },
  locationOptionsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  locationButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    gap: 8,
  },
  locationButtonDisabled: {
    opacity: 0.6,
  },
  locationButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  selectedLocationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0, 200, 0, 0.1)',
    borderRadius: 6,
    marginTop: 8,
  },
  selectedLocationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  selectedLocationText: {
    fontSize: 12,
    fontWeight: '500',
  },
  clearLocationButton: {
    padding: 4,
  },
  warningLocationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 149, 0, 0.1)',
    borderRadius: 6,
    marginTop: 8,
    gap: 8,
  },
  warningLocationText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#ff9500',
    flex: 1,
  },
  locationInputContainer: {
    marginTop: 12,
    marginBottom: 8,
  },
  locationInputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#666',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerContainer: {
    borderRadius: 12,
    padding: 20,
    margin: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  recurringToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    gap: 12,
  },
  recurringToggleText: {
    fontSize: 14,
    fontWeight: '500',
  },
  recurringOptions: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  weekdaysContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 12,
  },
  weekdayButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.2)',
    minWidth: 44,
    alignItems: 'center',
  },
  weekdayButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  recurringEndDateContainer: {
    marginTop: 16,
  },
  recurringPreview: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 8,
    textAlign: 'center',
  },
  timeRestrictionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 4,
    gap: 6,
  },
  timeRestrictionText: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  // Participation type styles
  participationTypeContainer: {
    gap: 12,
  },
  participationTypeOption: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    backgroundColor: '#F8F9FA',
  },
  participationTypeText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  participationTypeSubtext: {
    fontSize: 14,
    opacity: 0.8,
  },
  // Duration styles
  durationContainer: {
    flexDirection: 'row',
    gap: 16,
  },
  durationInputGroup: {
    flex: 1,
    alignItems: 'center',
  },
  durationInput: {
    width: 60,
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '500',
  },
  durationLabel: {
    fontSize: 14,
    marginTop: 8,
    opacity: 0.8,
    fontWeight: '500',
  },
  durationPreviewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F0F5FF',
    borderRadius: 8,
    gap: 8,
  },
  durationPreviewText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.light.tint,
  },
  // Checkbox styles
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderRadius: 4,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxLabel: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
});
