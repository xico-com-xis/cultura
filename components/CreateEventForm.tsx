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
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthContext';
import { EventType, TicketInfo, useEvents } from '@/context/EventsContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Coordinates, createFullAddress, geocodeAddress, getCityDefaultCoordinates } from '@/utils/geocoding';
import { uploadImageToSupabase } from '@/utils/imageUpload';

interface CreateEventFormProps {
  onClose: () => void;
  onEventCreated?: () => void;
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

export default function CreateEventForm({ onClose, onEventCreated }: CreateEventFormProps) {
  const colorScheme = useColorScheme();
  const { addEvent, filters, availableCities } = useEvents();
  const { user } = useAuth();

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedType, setSelectedType] = useState<EventType>('other');
  const [location, setLocation] = useState('');
  const [selectedCity, setSelectedCity] = useState(availableCities[0] || '');
  const [localImageUri, setLocalImageUri] = useState(''); // Store local image URI
  const [uploadedImageUrl, setUploadedImageUrl] = useState(''); // Store uploaded URL
  
  // Location state
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [isGeocodingLoading, setIsGeocodingLoading] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showLocationInput, setShowLocationInput] = useState(false);
  
  // Date/time state
  const [eventDate, setEventDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<'date' | 'time'>('date');
  
  // Ticket info state
  const [ticketType, setTicketType] = useState<'free' | 'paid' | 'donation'>('free');
  const [ticketPrice, setTicketPrice] = useState('');
  const [purchaseLink, setPurchaseLink] = useState('');

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

  // Validation and submission
  const isFormValid = () => {
    return title.trim() !== '' && 
           description.trim() !== '' && 
           selectedCity !== '' &&
           coordinates !== null && // Precise location is now mandatory
           localImageUri.trim() !== ''; // Local image is now mandatory
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!isFormValid()) {
      let errorMessage = 'Please fill in all required fields';
      if (!coordinates) {
        errorMessage = 'Please set a precise location using "Find Address" or "Pick on Map" buttons.';
      } else if (!localImageUri.trim()) {
        errorMessage = 'Please add an image for your event.';
      }
      Alert.alert('Error', errorMessage);
      return;
    }

    if (!user) {
      Alert.alert('Error', 'You must be logged in to create events');
      return;
    }

    if (isSubmitting) {
      return; // Prevent double submission
    }

    setIsSubmitting(true);

    try {
      // Upload image first if we have a local image
      let finalImageUrl = uploadedImageUrl; // Use existing uploaded URL if available
      
      if (localImageUri && !finalImageUrl) {
        try {
          setUploadProgress('Uploading image...');
          const uploadResult = await uploadImageToSupabase(localImageUri, user.id, title.trim());
          if (uploadResult.success && uploadResult.url) {
            finalImageUrl = uploadResult.url;
            setUploadedImageUrl(uploadResult.url); // Store the uploaded URL
            setUploadProgress('Creating event...');
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
          setUploadProgress('Creating event...');
        }
      }
      
      // Fallback to city coordinates if no specific location
      if (!eventCoordinates) {
        eventCoordinates = getCityDefaultCoordinates(selectedCity);
      }

      setUploadProgress('Creating event...');

      // Create the event
      const newEvent = {
        title: title.trim(),
        type: selectedType,
        schedule: [
          {
            date: eventDate.toISOString(),
          },
        ],
        location: location.trim(),
        city: selectedCity,
        country: filters.selectedCountry,
        description: description.trim(),
        organizer: {
          id: user.id,
          name: user.user_metadata?.displayName || 'User',
          profileImage: undefined,
        },
        professionals: [],
        accessibility: [],
        ticketInfo,
        coordinates: eventCoordinates || undefined, // Convert null to undefined for type compatibility
        image: finalImageUrl || undefined, // Include the uploaded image URL
      };

      await addEvent(newEvent);
      
      Alert.alert(
        'Success!', 
        'Your event has been created successfully!',
        [
          {
            text: 'OK',
            onPress: () => {
              onEventCreated?.();
              onClose();
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error creating event:', error);
      Alert.alert(
        'Error', 
        'Failed to create event. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsSubmitting(false);
      setUploadProgress(null);
    }
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    console.log('Date picker event:', event.type, 'Selected date:', selectedDate, 'Current date:', eventDate);
    const currentDate = selectedDate || eventDate;
    
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    
    if (event.type === 'set' || Platform.OS !== 'android') {
      // User confirmed the selection
      if (datePickerMode === 'date') {
        // Set the date part, keeping the current time
        const newDate = new Date(eventDate);
        newDate.setFullYear(currentDate.getFullYear());
        newDate.setMonth(currentDate.getMonth());
        newDate.setDate(currentDate.getDate());
        console.log('Setting new date:', newDate);
        setEventDate(newDate);
        
        // On iOS, automatically show time picker after date selection
        if (Platform.OS !== 'android') {
          setTimeout(() => {
            setDatePickerMode('time');
            setShowDatePicker(true);
          }, 300);
        }
      } else {
        // Time mode - set the time part
        const newDate = new Date(eventDate);
        newDate.setHours(currentDate.getHours());
        newDate.setMinutes(currentDate.getMinutes());
        console.log('Setting new time:', newDate);
        setEventDate(newDate);
        setDatePickerMode('date'); // Reset for next time
        
        if (Platform.OS !== 'android') {
          setShowDatePicker(false);
        }
      }
    } else if (event.type === 'dismissed') {
      // User cancelled
      console.log('Date picker dismissed');
      setDatePickerMode('date'); // Reset for next time
      if (Platform.OS !== 'android') {
        setShowDatePicker(false);
      }
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

  const clearForm = () => {
    setTitle('');
    setDescription('');
    setSelectedType('other');
    setLocation('');
    setLocalImageUri('');
    setUploadedImageUrl('');
    setCoordinates(null);
    setShowLocationInput(false);
    setTicketType('free');
    setTicketPrice('');
    setPurchaseLink('');
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
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
                autoFocus={true}
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
                {uploadProgress || 'Creating Event...'}
              </ThemedText>
            </View>
          ) : (
            <ThemedText style={styles.submitButtonText}>Create Event</ThemedText>
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
});
