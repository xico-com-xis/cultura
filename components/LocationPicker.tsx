import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Coordinates, getCityDefaultCoordinates } from '@/utils/geocoding';
import * as Location from 'expo-location';
import React, { useEffect, useRef, useState } from 'react';
import {
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

  const handleMapPress = async (event: any) => {
    const coordinate = event.nativeEvent.coordinate;
    setSelectedLocation(coordinate);

    // Optional: Reverse geocode to get address
    try {
      const reverseGeocodedLocation = await Location.reverseGeocodeAsync(coordinate);
      if (reverseGeocodedLocation.length > 0) {
        const location = reverseGeocodedLocation[0];
        console.log('Reverse geocoded:', location);
      }
    } catch (error) {
      console.log('Reverse geocoding failed:', error);
    }
  };

  const handleCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Location permission is required to use your current location.'
        );
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({});
      const coordinate = {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      };

      setSelectedLocation(coordinate);
      const newRegion = {
        ...coordinate,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      };
      setRegion(newRegion);
      
      if (mapRef.current) {
        mapRef.current.animateToRegion(newRegion, 1000);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to get your current location.');
    }
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
          
          <TouchableOpacity 
            onPress={handleConfirm} 
            style={[styles.headerButton, { opacity: selectedLocation ? 1 : 0.5 }]}
            disabled={!selectedLocation}
          >
            <ThemedText style={[styles.headerButtonText, { color: Colors[colorScheme ?? 'light'].tint }]}>
              Confirm
            </ThemedText>
          </TouchableOpacity>
        </View>

        {/* Instructions */}
        <View style={styles.instructionsContainer}>
          <ThemedText style={styles.instructions}>
            Tap on the map to select the exact location for your event
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
          showsUserLocation
          showsMyLocationButton={false}
        >
          {selectedLocation && (
            <Marker
              coordinate={selectedLocation}
              pinColor={Colors[colorScheme ?? 'light'].tint}
              title="Event Location"
              description="Selected location for your event"
            />
          )}
        </MapView>

        {/* Bottom Controls */}
        <View style={[styles.bottomControls, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
          <TouchableOpacity 
            style={[styles.locationButton, { backgroundColor: Colors[colorScheme ?? 'light'].tint }]}
            onPress={handleCurrentLocation}
          >
            <IconSymbol name="location" size={20} color="white" />
            <Text style={styles.locationButtonText}>Use Current Location</Text>
          </TouchableOpacity>

          {selectedLocation && (
            <View style={styles.coordinatesInfo}>
              <ThemedText style={styles.coordinatesText}>
                📍 Lat: {selectedLocation.latitude.toFixed(6)}, Lng: {selectedLocation.longitude.toFixed(6)}
              </ThemedText>
            </View>
          )}
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
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 10,
  },
  locationButtonText: {
    color: 'white',
    fontWeight: '600',
    marginLeft: 8,
  },
  coordinatesInfo: {
    alignItems: 'center',
  },
  coordinatesText: {
    fontSize: 12,
    opacity: 0.7,
  },
});
