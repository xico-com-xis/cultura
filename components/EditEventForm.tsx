import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import {
    ActionSheetIOS,
    ActivityIndicator,
    Alert,
    Image,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

import LocationPicker from '@/components/LocationPicker';
import SmartTextInput, { ExtendedOrganizer } from '@/components/SmartTextInput';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthContext';
import { Event, EventType, TicketInfo, useEvents } from '@/context/EventsContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Coordinates, createFullAddress, geocodeAddress, getCityDefaultCoordinates, LocationSuggestion } from '@/utils/geocoding';
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
  const [location, setLocation] = useState(''); // Keep for compatibility with form submission
  const [selectedCity, setSelectedCity] = useState(event.city);
  const [localImageUris, setLocalImageUris] = useState<string[]>(event.images || []); // Store local image URIs (max 5)
  const [uploadedImageUrls, setUploadedImageUrls] = useState<string[]>(event.images || []); // Store uploaded URLs
  const [selectedParticipants, setSelectedParticipants] = useState<ExtendedOrganizer[]>([]); // Tagged participants (app + external)
  
  // Location state - initialize with event coordinates
  const [coordinates, setCoordinates] = useState<Coordinates | null>(event.coordinates || null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<LocationSuggestion | null>(null);
  const [isMapLocation, setIsMapLocation] = useState(false); // Track if coordinates are from map picker
  
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

  // Auto-geocode when location and city are both filled - removed old auto-geocoding logic

  // Debug selectedSuggestion changes
  useEffect(() => {
    console.log('selectedSuggestion state changed:', selectedSuggestion);
  }, [selectedSuggestion]);

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
    // Function to clean description text from mentions markup
    const cleanDescriptionText = (text: string): string => {
      return text.replace(/@\[([^\]]+)\]\([^)]+\)/g, '$1');
    };
    
    const cleanedDesc = cleanDescriptionText(description);
    const baseValid = title.trim() !== '' && 
           cleanedDesc.trim() !== '' && 
           selectedCity !== '' &&
           coordinates !== null && // Precise location is now mandatory
           localImageUris.length > 0 && // At least one image is now mandatory
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

  // Custom image picker function
  const pickImage = async () => {
    if (localImageUris.length >= 5) {
      Alert.alert('Maximum Images', 'You can only add up to 5 images per event.');
      return;
    }

    try {
      const showActionSheet = () => {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options: ['Cancel', 'Take Photo', 'Choose from Library'],
            cancelButtonIndex: 0,
          },
          async (buttonIndex) => {
            if (buttonIndex === 1) {
              // Take photo
              const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [16, 9],
                quality: 0.8,
              });

              if (!result.canceled && result.assets[0]) {
                setLocalImageUris([...localImageUris, result.assets[0].uri]);
              }
            } else if (buttonIndex === 2) {
              // Choose from library
              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [16, 9],
                quality: 0.8,
              });

              if (!result.canceled && result.assets[0]) {
                setLocalImageUris([...localImageUris, result.assets[0].uri]);
              }
            }
          }
        );
      };

      if (Platform.OS === 'ios') {
        showActionSheet();
      } else {
        // Android - show alert
        Alert.alert(
          'Select Image',
          'Choose an option',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Take Photo',
              onPress: async () => {
                const result = await ImagePicker.launchCameraAsync({
                  mediaTypes: ImagePicker.MediaTypeOptions.Images,
                  allowsEditing: true,
                  aspect: [16, 9],
                  quality: 0.8,
                });

                if (!result.canceled && result.assets[0]) {
                  setLocalImageUris([...localImageUris, result.assets[0].uri]);
                }
              }
            },
            {
              text: 'Choose from Library',
              onPress: async () => {
                const result = await ImagePicker.launchImageLibraryAsync({
                  mediaTypes: ImagePicker.MediaTypeOptions.Images,
                  allowsEditing: true,
                  aspect: [16, 9],
                  quality: 0.8,
                });

                if (!result.canceled && result.assets[0]) {
                  setLocalImageUris([...localImageUris, result.assets[0].uri]);
                }
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };

  // Function to clean description text from mentions markup
  const cleanDescriptionText = (text: string): string => {
    return text.replace(/@\[([^\]]+)\]\([^)]+\)/g, '$1');
  };

  const handleSubmit = async () => {
    if (!isFormValid()) {
      let errorMessage = 'Please fill in all required fields';
      const now = new Date();
      const originalFirstDate = new Date(event.schedule[0]?.date || 0);
      const isDateChanged = Math.abs(eventDate.getTime() - originalFirstDate.getTime()) > 60000;
      
      if (!coordinates) {
        errorMessage = 'Please set a precise location using the "Pick on Map" button.';
      } else if (localImageUris.length === 0) {
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
      // Upload images first if we have local images that are different from existing ones
      let finalImageUrls = [...uploadedImageUrls]; // Use existing uploaded URLs if available
      
      if (localImageUris.length > 0 && finalImageUrls.length < localImageUris.length) {
        setUploadProgress('Uploading images...');
        
        // Upload each new local image
        for (let i = finalImageUrls.length; i < localImageUris.length; i++) {
          const localUri = localImageUris[i];
          try {
            setUploadProgress(`Uploading image ${i + 1} of ${localImageUris.length}...`);
            const uploadResult = await uploadImageToSupabase(localUri, user.id, title.trim());
            if (uploadResult.success && uploadResult.url) {
              finalImageUrls.push(uploadResult.url);
              setUploadedImageUrls([...finalImageUrls]); // Update state
            } else {
              throw new Error(uploadResult.error || 'Image upload failed');
            }
          } catch (uploadError) {
            console.error(`Image ${i + 1} upload error:`, uploadError);
            
            let errorMessage = `Failed to upload image ${i + 1}. Please try again.`;
            if (uploadError instanceof Error) {
              if (uploadError.message.includes('timeout')) {
                errorMessage = `Image ${i + 1} upload timed out. Please check your internet connection or try a smaller image.`;
              } else if (uploadError.message.includes('Network request timed out')) {
                errorMessage = `Network timeout on image ${i + 1}. Please check your internet connection and try again.`;
              } else if (uploadError.message.includes('policy')) {
                errorMessage = 'Permission error. Please contact support.';
              }
            }
            
            Alert.alert('Upload Error', errorMessage, [{ text: 'OK' }]);
            return;
          }
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

      // Use coordinates from map picker
      let eventCoordinates = coordinates;
      
      // Fallback to city coordinates if no specific location selected
      if (!eventCoordinates) {
        eventCoordinates = getCityDefaultCoordinates(selectedCity);
      }

      setUploadProgress('Updating event...');

      // Process all participants: both app users and external participants
      const allParticipants: ExtendedOrganizer[] = selectedParticipants.map(participant => ({
        id: participant.id,
        name: participant.name,
        email: participant.email,
        profileImage: participant.profileImage,
        isExternal: participant.isExternal || false,
      }));

      // Clean description text for display (remove mention markup)
      const cleanedDescription = cleanDescriptionText(description.trim());

      // Create the updated event
      const updatedEvent = {
        ...event, // Keep existing event data
        title: title.trim(),
        type: selectedType,
        schedule: generateRecurringDates(),
        location: selectedSuggestion ? selectedSuggestion.displayName : location.trim(),
        city: selectedCity,
        country: filters.selectedCountry,
        description: description.trim(),
        displayDescription: cleanedDescription,
        participants: allParticipants,
        participationType,
        durationMinutes: getTotalDurationMinutes(),
        ticketInfo,
        coordinates: eventCoordinates || undefined,
        images: finalImageUrls.length > 0 ? finalImageUrls : undefined,
        ...(selectedSuggestion && {
          poiInfo: {
            id: selectedSuggestion.id,
            name: selectedSuggestion.displayName,
            address: selectedSuggestion.fullAddress,
            category: (selectedSuggestion as any).category || 'venue'
          }
        })
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
  const handleLocationPicked = (pickedCoordinates: Coordinates, venueInfo?: LocationSuggestion) => {
    console.log('handleLocationPicked called with:', { pickedCoordinates, venueInfo });
    setCoordinates(pickedCoordinates);
    setIsMapLocation(true); // Mark as map location
    
    if (venueInfo) {
      // If venue was selected from map POI, use venue information
      setSelectedSuggestion(venueInfo);
      console.log('Venue picked from map:', venueInfo);
      console.log('Setting selectedSuggestion to:', venueInfo);
    } else {
      // If custom location was picked, clear venue selection
      setSelectedSuggestion(null);
      console.log('Custom location picked from map:', pickedCoordinates);
    }
  };

  const clearLocation = () => {
    setCoordinates(null);
    setLocation('');
    setSelectedSuggestion(null);
    setIsMapLocation(false);
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
          <ThemedText style={styles.sublabel}>
            Describe your event. Type '@' to tag participants (app users or external people).
          </ThemedText>
          <SmartTextInput
            value={description}
            onChangeText={setDescription}
            onParticipantsChange={(participants) => {
              console.log('📋 EditEventForm - onParticipantsChange called with:', participants);
              console.log('📋 EditEventForm - current selectedParticipants before update:', selectedParticipants);
              setSelectedParticipants(participants);
              console.log('📋 EditEventForm - selectedParticipants will be set to:', participants);
            }}
            placeholder="Describe your event... Type @ to tag participants"
            multiline
            style={[
              styles.textArea,
              {
                backgroundColor: Colors[colorScheme ?? 'light'].background,
                borderColor: Colors[colorScheme ?? 'light'].text + '30',
                color: Colors[colorScheme ?? 'light'].text,
              },
            ]}
          />
          {/* Participants count indicator */}
          {selectedParticipants.length > 0 && (
            <View style={styles.participantsIndicator}>
              <IconSymbol name="person.2" size={16} color={Colors[colorScheme ?? 'light'].tint} />
              <ThemedText style={[styles.participantsCountText, { color: Colors[colorScheme ?? 'light'].tint }]}>
                {selectedParticipants.length} participant{selectedParticipants.length !== 1 ? 's' : ''} tagged
              </ThemedText>
            </View>
          )}
        </View>

        {/* Event Images Upload */}
        {user && (
          <View style={styles.inputContainer}>
            <ThemedText style={styles.label}>Event Images * (Max 5)</ThemedText>
            <ThemedText style={[styles.label, { fontSize: 14, color: '#666', marginBottom: 12 }]}>
              Add up to 5 images to showcase your event
            </ThemedText>
            
            {/* Selected Images Preview - show first */}
            {localImageUris.length > 0 && (
              <View style={styles.selectedImagesContainer}>
                <ThemedText style={[styles.label, { fontSize: 14, marginBottom: 8 }]}>
                  Selected Images ({localImageUris.length}/5)
                </ThemedText>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {localImageUris.map((uri, index) => (
                    <View key={index} style={styles.selectedImageItem}>
                      <Image source={{ uri }} style={styles.selectedImagePreview} />
                      <TouchableOpacity 
                        style={[styles.removeImageButton, { top: 4, right: 4 }]}
                        onPress={() => {
                          const newUris = localImageUris.filter((_, i) => i !== index);
                          setLocalImageUris(newUris);
                        }}
                      >
                        <IconSymbol name="xmark.circle.fill" size={20} color="#FF3B30" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}
            
            {/* Add Image Button - only show when under 5 images */}
            {localImageUris.length < 5 && (
              <TouchableOpacity 
                style={[
                  styles.addImageButton,
                  {
                    backgroundColor: Colors[colorScheme ?? 'light'].tint,
                    borderColor: Colors[colorScheme ?? 'light'].tint,
                  }
                ]} 
                onPress={pickImage}
              >
                <ThemedText style={styles.addImageButtonText}>
                  {localImageUris.length === 0 ? '+ Add Image' : '+ Add Another Image'}
                </ThemedText>
              </TouchableOpacity>
            )}
            
            {/* Max images reached message */}
            {localImageUris.length >= 5 && (
              <View style={styles.maxImagesContainer}>
                <ThemedText style={[styles.label, { fontSize: 14, color: '#4C8BF5', textAlign: 'center' }]}>
                  ✓ Maximum images reached (5/5)
                </ThemedText>
              </View>
            )}
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
            Required: Use the map to select the exact location for your event
          </ThemedText>
          
          <View style={styles.locationOptionsContainer}>
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

          {/* Selected Location Display - Shows POI name or coordinates from map */}
          {coordinates && (
            <View style={styles.selectedSuggestionContainer}>
              <View style={styles.selectedSuggestionContent}>
                <IconSymbol name="checkmark.circle" size={16} color={Colors[colorScheme ?? 'light'].tint} />
                <View style={styles.selectedSuggestionTextContainer}>
                  <ThemedText style={styles.selectedSuggestionDisplayName}>
                    ✓ {selectedSuggestion ? selectedSuggestion.displayName : 'Location from Map'}
                  </ThemedText>
                  <ThemedText style={styles.selectedSuggestionFullAddress}>
                    {selectedSuggestion 
                      ? selectedSuggestion.fullAddress 
                      : `📍 ${coordinates.latitude.toFixed(4)}, ${coordinates.longitude.toFixed(4)}`
                    }
                  </ThemedText>
                </View>
                <TouchableOpacity 
                  onPress={() => {
                    setSelectedSuggestion(null);
                    setCoordinates(null);
                    setIsMapLocation(false);
                  }}
                  style={styles.clearLocationButton}
                >
                  <IconSymbol name="xmark.circle.fill" size={20} color={Colors[colorScheme ?? 'light'].tabIconDefault} />
                </TouchableOpacity>
              </View>
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
  clearLocationButton: {
    padding: 4,
  },
  autocompleteHelper: {
    fontSize: 12,
    color: '#888',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  autocompleteContainer: {
    position: 'relative',
  },
  suggestionLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 8,
  },
  suggestionLoadingText: {
    fontSize: 12,
    color: '#666',
  },
  suggestionsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 8,
    maxHeight: 200,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  suggestionItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  suggestionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  suggestionTextContainer: {
    flex: 1,
    minWidth: 0, // Allow text to shrink
  },
  suggestionDisplayName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  suggestionFullAddress: {
    fontSize: 12,
    color: '#666',
  },
  selectedSuggestionContainer: {
    marginTop: 8,
    padding: 12,
    backgroundColor: 'rgba(76, 139, 245, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(76, 139, 245, 0.3)',
  },
  selectedSuggestionContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
  },
  selectedSuggestionTextContainer: {
    flex: 1,
    marginLeft: 8,
    marginRight: 8,
  },
  selectedSuggestionDisplayName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4C8BF5',
    marginBottom: 2,
  },
  selectedSuggestionFullAddress: {
    fontSize: 12,
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
  // Multiple images styles
  imagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  imagePickerContainer: {
    position: 'relative',
    width: '48%',
    aspectRatio: 1,
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    zIndex: 1,
  },
  // Selected images preview styles
  selectedImagesContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
  },
  selectedImageItem: {
    position: 'relative',
    marginRight: 12,
  },
  selectedImagePreview: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  addImageButton: {
    backgroundColor: '#4C8BF5', // Will be overridden by inline style
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
    borderWidth: 1,
    minHeight: 44,
  },
  addImageButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  maxImagesContainer: {
    padding: 16,
    backgroundColor: '#E8F4FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4C8BF5',
  },
  participantsIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(76, 139, 245, 0.1)',
    borderRadius: 12,
    alignSelf: 'flex-start',
    gap: 6,
  },
  participantsCountText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
