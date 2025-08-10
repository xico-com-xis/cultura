import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Coordinates, getCityDefaultCoordinates } from '@/utils/geocoding';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface LocationPickerProps {
  visible: boolean;
  onClose: () => void;
  onLocationSelect: (coordinates: Coordinates, address?: string) => void;
  initialLocation?: Coordinates;
  city?: string;
  country?: string;
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
  const [tempLocation, setTempLocation] = useState<Coordinates | null>(null);
  const [isProcessingLocation, setIsProcessingLocation] = useState(false);
  const [region, setRegion] = useState<Region>({
    latitude: initialLocation?.latitude || 38.7223, // Default to Lisboa
    longitude: initialLocation?.longitude || -9.1393,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });

  // Initialize map region when modal opens
  useEffect(() => {
    if (visible && !initialLocation && city) {
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
  }, [visible, city, initialLocation]);

  // Debug selectedLocation changes
  useEffect(() => {
    console.log('selectedLocation changed:', selectedLocation);
  }, [selectedLocation]);

  const handleMapPress = (event: any) => {
    const coordinate = event.nativeEvent.coordinate;
    console.log('Map pressed at:', coordinate, 'Event details:', {
      action: event.nativeEvent.action,
      target: event.nativeEvent.target,
    });
    
    console.log('Setting selectedLocation to:', coordinate);
    
    // Force immediate update using multiple approaches
    setSelectedLocation(() => {
      console.log('State update function called with:', coordinate);
      return coordinate;
    });
    
    // Also set temp location as backup
    setTempLocation(coordinate);
    
    // Try to force a map update
    if (mapRef.current) {
      console.log('Forcing map to update region slightly');
      const currentRegion = region;
      mapRef.current.animateToRegion({
        ...currentRegion,
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
      }, 0); // 0ms animation = immediate
    }
    
    console.log('selectedLocation should be set now');
    
    // Provide haptic feedback for immediate response
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Do reverse geocoding in background without blocking UI
    handleReverseGeocode(coordinate);
  };

  const handleReverseGeocode = async (coordinate: Coordinates) => {
    try {
      setIsProcessingLocation(true);
      const reverseGeocodedLocation = await Location.reverseGeocodeAsync(coordinate);
      if (reverseGeocodedLocation.length > 0) {
        const location = reverseGeocodedLocation[0];
        console.log('Reverse geocoded:', location);
      }
    } catch (error) {
      console.log('Reverse geocoding failed:', error);
    } finally {
      setIsProcessingLocation(false);
    }
  };

  const handleMarkerDragEnd = (event: any) => {
    const coordinate = event.nativeEvent.coordinate;
    console.log('Marker dragged to:', coordinate);
    setSelectedLocation(coordinate);
    
    // Do reverse geocoding in background
    handleReverseGeocode(coordinate);
  };

  const handleConfirm = () => {
    if (selectedLocation) {
      onLocationSelect(selectedLocation);
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
            Tap anywhere on the map to place a pin. You can tap on buildings, landmarks, or empty space.
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
          onLongPress={handleMapPress} // Alternative way to place pin
          onPoiClick={handleMapPress} // Handle POI clicks the same as regular map clicks
          showsUserLocation
          showsMyLocationButton={false}
          showsPointsOfInterest={true} // Keep POIs visible but handle clicks
          showsBuildings={true}
          scrollEnabled={true}
          zoomEnabled={true}
          rotateEnabled={false}
          pitchEnabled={false}
          toolbarEnabled={false}
          moveOnMarkerPress={false}
          minZoomLevel={10}
          maxZoomLevel={20}
          onMapReady={() => {
            console.log('Map is ready');
          }}
        >
          {(selectedLocation || tempLocation) && (
            <Marker
              key={`marker-${(selectedLocation || tempLocation)!.latitude}-${(selectedLocation || tempLocation)!.longitude}`} // Force re-render
              coordinate={selectedLocation || tempLocation!}
              pinColor={Colors[colorScheme ?? 'light'].tint}
              title="Event Location"
              description="Drag to adjust or tap map to relocate"
              draggable={true}
              onDragEnd={handleMarkerDragEnd}
              onDragStart={() => {
                console.log('Marker drag started');
              }}
            />
          )}
        </MapView>

        {/* Bottom Controls */}
        <View style={[styles.bottomControls, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
          {selectedLocation && (
            <View style={styles.coordinatesInfo}>
              {isProcessingLocation ? (
                <View style={styles.processingContainer}>
                  <ActivityIndicator size="small" color={Colors[colorScheme ?? 'light'].tint} />
                  <ThemedText style={styles.processingText}>Processing location...</ThemedText>
                </View>
              ) : (
                <ThemedText style={styles.coordinatesText}>
                  📍 Selected: {selectedLocation.latitude.toFixed(6)}, {selectedLocation.longitude.toFixed(6)}
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
            disabled={!selectedLocation || isProcessingLocation}
          >
            <IconSymbol name="checkmark" size={20} color="white" />
            <Text style={styles.confirmButtonText}>
              {selectedLocation ? 'Confirm Location' : 'Tap map to select location'}
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
