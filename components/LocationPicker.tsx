import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Coordinates, getCityDefaultCoordinates, LocationSuggestion } from '@/utils/geocoding';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import {
    Alert,
    Dimensions,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import MapView, { MapPressEvent, Marker, PoiClickEvent, PROVIDER_GOOGLE, Region } from 'react-native-maps';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface LocationPickerProps {
  visible: boolean;
  onClose: () => void;
  onLocationSelect: (coordinates: Coordinates, venueInfo?: LocationSuggestion) => void;
  initialLocation?: Coordinates;
  city?: string;
  country?: string;
}

interface NearbyVenue extends LocationSuggestion {
  category?: string;
  isPopular?: boolean;
}

export default function LocationPicker({
  visible,
  onClose,
  onLocationSelect,
  initialLocation,
  city,
  country,
}: LocationPickerProps) {
  const colorScheme = useColorScheme();
  const mapRef = useRef<MapView>(null);
  const [selectedLocation, setSelectedLocation] = useState<Coordinates | null>(
    initialLocation || null
  );
  const [selectedVenue, setSelectedVenue] = useState<NearbyVenue | null>(null);
  const [tempLocation, setTempLocation] = useState<Coordinates | null>(null);
  const [region, setRegion] = useState<Region>({
    latitude: initialLocation?.latitude || 38.7223, // Default to Lisboa
    longitude: initialLocation?.longitude || -9.1393,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });

  // Initialize map region when modal opens
  useEffect(() => {
    if (visible) {
      if (!initialLocation && city) {
        // Use city default coordinates if no initial location
        const cityCoords = getCityDefaultCoordinates(city);
        if (cityCoords) {
          const newRegion = {
            ...cityCoords,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
          };
          setRegion(newRegion);
          setSelectedLocation(cityCoords);
        }
      }
    }
  }, [visible, city, initialLocation]);

  // Debug selectedLocation changes
  useEffect(() => {
    console.log('selectedLocation changed:', selectedLocation);
  }, [selectedLocation]);

  // Debug selectedVenue changes
  useEffect(() => {
    console.log('selectedVenue changed:', selectedVenue);
    if (selectedVenue) {
      console.log('selectedVenue details:', {
        id: selectedVenue.id,
        displayName: selectedVenue.displayName,
        fullAddress: selectedVenue.fullAddress,
        category: selectedVenue.category
      });
    }
  }, [selectedVenue]);

  const handleMapPress = (event: MapPressEvent) => {
    const coordinate = event.nativeEvent.coordinate;
    console.log('Map pressed at:', coordinate);
    
    setSelectedLocation(coordinate);
    // Clear venue selection when user taps on map (they want to select custom location)
    if (selectedVenue) {
      console.log('Clearing venue selection - user selected custom location');
      setSelectedVenue(null);
    }
    setTempLocation(coordinate);
    
    // Provide haptic feedback for immediate response
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleVenueMarkerPress = (venue: NearbyVenue) => {
    setSelectedVenue(venue);
    setSelectedLocation(venue.coordinates);
    setTempLocation(venue.coordinates);
    
    // Provide haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handlePoiClick = (event: PoiClickEvent) => {
    const { coordinate, name, placeId } = event.nativeEvent;
    
    console.log('POI clicked:', { name, placeId, coordinate });
    
    // Clean up the name by removing newlines and extra spaces
    const cleanName = name?.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim() || 'Selected Location';
    
    // Create a venue info object from the POI data
    const poiVenue: NearbyVenue = {
      id: placeId || `poi-${coordinate.latitude}-${coordinate.longitude}`,
      displayName: cleanName,
      fullAddress: cleanName,
      coordinates: coordinate,
      relevanceScore: 1.0,
      category: 'venue' // Default category for POIs
    };
    
    console.log('Created POI venue:', poiVenue);
    
    // Set the POI as selected venue
    setSelectedVenue(poiVenue);
    setSelectedLocation(coordinate);
    setTempLocation(coordinate);
    
    // Provide haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleMarkerDragEnd = (event: any) => {
    const coordinate = event.nativeEvent.coordinate;
    setSelectedLocation(coordinate);
    setSelectedVenue(null); // Clear venue selection when dragging
  };

  const handleConfirm = () => {
    if (selectedLocation) {
      console.log('handleConfirm called with selectedLocation:', selectedLocation);
      console.log('handleConfirm called with selectedVenue:', selectedVenue);
      
      // If a venue is selected, pass venue info, otherwise just coordinates
      if (selectedVenue) {
        console.log('Calling onLocationSelect with venue:', selectedVenue);
        onLocationSelect(selectedLocation, selectedVenue);
      } else {
        console.log('Calling onLocationSelect without venue');
        onLocationSelect(selectedLocation);
      }
      onClose();
    } else {
      Alert.alert('No Location Selected', 'Please tap on the map to select a location.');
    }
  };

  const handleCancel = () => {
    setSelectedLocation(initialLocation || null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleCancel}
    >
      <ThemedView style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: Colors[colorScheme ?? 'light'].text + '20' }]}>
          <TouchableOpacity onPress={handleCancel} style={styles.headerButton}>
            <ThemedText style={styles.headerButtonText}>Cancel</ThemedText>
          </TouchableOpacity>
          
          <ThemedText style={styles.headerTitle}>Select Location</ThemedText>
          
          <View style={styles.headerButton} />
        </View>

        {/* Instructions */}
        <View style={styles.instructionsContainer}>
          <ThemedText style={styles.instructions}>
            Tap on any Google Maps point of interest (restaurant, bar, landmark) or anywhere on the map to select a location.
          </ThemedText>
        </View>

        {/* Map */}
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          region={region}
          onRegionChangeComplete={setRegion}
          onPress={handleMapPress}
          onPoiClick={handlePoiClick}
          showsUserLocation
          showsMyLocationButton={false}
          showsPointsOfInterest={true}
          showsBuildings={true}
          scrollEnabled={true}
          zoomEnabled={true}
          rotateEnabled={false}
          pitchEnabled={false}
          toolbarEnabled={false}
          moveOnMarkerPress={false}
          minZoomLevel={3}
          maxZoomLevel={20}
        >
          {/* Selected location marker */}
          {(selectedLocation || tempLocation) && (
            <Marker
              key={`marker-${(selectedLocation || tempLocation)!.latitude}-${(selectedLocation || tempLocation)!.longitude}`}
              coordinate={selectedLocation || tempLocation!}
              pinColor={selectedVenue ? '#FF6B6B' : Colors[colorScheme ?? 'light'].tint}
              title={selectedVenue ? selectedVenue.displayName : "Event Location"}
              description={selectedVenue ? selectedVenue.fullAddress : "Drag to adjust or tap map to relocate"}
              draggable={!selectedVenue} // Only allow dragging for custom locations
              onDragEnd={handleMarkerDragEnd}
            />
          )}
        </MapView>

        {/* Bottom Controls */}
        <View style={[styles.bottomControls, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
          {selectedLocation && (
            <View style={styles.coordinatesInfo}>
              {selectedVenue ? (
                <View>
                  <ThemedText style={[styles.coordinatesText, { fontWeight: '600' }]}>
                    📍 {selectedVenue.displayName}
                  </ThemedText>
                  <ThemedText style={[styles.coordinatesText, { fontSize: 12, opacity: 0.7 }]}>
                    {selectedVenue.fullAddress}
                  </ThemedText>
                  {selectedVenue.category && (
                    <ThemedText style={[styles.coordinatesText, { fontSize: 11, opacity: 0.6 }]}>
                      {selectedVenue.category.charAt(0).toUpperCase() + selectedVenue.category.slice(1)}
                    </ThemedText>
                  )}
                </View>
              ) : (
                <ThemedText style={styles.coordinatesText}>
                  📍 Custom location: {selectedLocation.latitude.toFixed(6)}, {selectedLocation.longitude.toFixed(6)}
                </ThemedText>
              )}
            </View>
          )}

          <TouchableOpacity 
            style={[
              styles.confirmButton, 
              { 
                backgroundColor: selectedLocation 
                  ? Colors[colorScheme ?? 'light'].tint 
                  : Colors[colorScheme ?? 'light'].text + '30',
              }
            ]}
            onPress={handleConfirm}
            disabled={!selectedLocation}
          >
            <IconSymbol name="checkmark" size={20} color="white" />
            <Text style={styles.confirmButtonText}>
              {selectedLocation 
                ? selectedVenue 
                  ? `Confirm ${selectedVenue.displayName}` 
                  : 'Confirm Custom Location'
                : 'Tap map to select location'
              }
            </Text>
          </TouchableOpacity>
        </View>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    paddingTop: 50, // Account for safe area
  },
  headerButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  headerButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  instructionsContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  instructions: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.7,
  },
  map: {
    flex: 1,
  },
  bottomControls: {
    padding: 20,
    paddingBottom: 40, // Account for safe area
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginTop: 10,
  },
  confirmButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 8,
  },
  coordinatesInfo: {
    alignItems: 'center',
    marginBottom: 8,
  },
  processingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  processingText: {
    fontSize: 12,
    opacity: 0.7,
  },
  coordinatesText: {
    fontSize: 12,
    opacity: 0.7,
  },
});
