import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { eventTypeIcons } from '@/constants/EventTypes';
import { Event, useEvents } from '@/context/EventsContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { getCityDefaultCoordinates } from '@/utils/geocoding';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Animated, Image, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, Polygon, Polyline, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function MapScreen() {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const params = useLocalSearchParams();
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const { 
    events, 
    filteredEvents, 
    filters, 
    setSelectedTypes, 
    setMapFilterEnabled, 
    setDrawingMode,
    setPolygonCoords,
    setSelectedCity,
    setShouldNavigateToMap
  } = useEvents();
  const [showEvents, setShowEvents] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [showEventPreview, setShowEventPreview] = useState(false);
  const previewAnimation = useRef(new Animated.Value(0)).current;
  
  // Check if any filters are currently active
  const hasActiveFilters = () => {
    return !(filters.selectedTypes.length === 1 && filters.selectedTypes.includes('all')) ||
           filters.selectedCity !== 'all' ||
           filters.mapFilterEnabled;
  };
  
  //Request location permissions and get current location
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('Permission to access location was denied');
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({});
      setLocation(currentLocation);
      
      // Initialize region based on current location
      if (currentLocation) {
        setRegion({
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
          latitudeDelta: 0.03,
          longitudeDelta: 0.03,
        });
      }
    })();
  }, []);

  // Handle URL parameters for navigation to specific event coordinates
  useEffect(() => {
    if (params.latitude && params.longitude) {
      const lat = parseFloat(params.latitude as string);
      const lng = parseFloat(params.longitude as string);
      
      if (!isNaN(lat) && !isNaN(lng)) {
        const newRegion = {
          latitude: lat,
          longitude: lng,
          latitudeDelta: 0.01, // Zoom in closer for specific event
          longitudeDelta: 0.01,
        };
        
        setRegion(newRegion);
        
        // Animate to the event location after a short delay to ensure map is ready
        setTimeout(() => {
          if (mapRef.current) {
            mapRef.current.animateToRegion(newRegion, 1000);
          }
        }, 500);
        
        console.log('Navigated to event coordinates:', { lat, lng, eventTitle: params.eventTitle });
      }
    }
  }, [params.latitude, params.longitude, params.eventId, params.eventTitle]);

  // New state for map region
  const [region, setRegion] = useState<Region>({
    latitude: 0,
    longitude: 0,
    latitudeDelta: 0.03,
    longitudeDelta: 0.03,
  });



  // Handle individual event press
  const handleEventPress = (event: Event) => {
    console.log('Event pressed:', event.title);
    setSelectedEvent(event);
    showEventPreviewModal();
  };

  // Show event preview with simple slide animation
  const showEventPreviewModal = () => {
    setShowEventPreview(true);
    Animated.timing(previewAnimation, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  // Hide event preview with simple slide animation
  const hideEventPreviewModal = () => {
    Animated.timing(previewAnimation, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setShowEventPreview(false);
      setSelectedEvent(null);
    });
  };

  // Navigate to event details page
  const navigateToEventDetails = () => {
    if (selectedEvent) {
      hideEventPreviewModal();
      // Small delay to let animation finish before navigation
      setTimeout(() => {
        router.push({
          pathname: '/event/[id]',
          params: { id: selectedEvent.id }
        });
      }, 150);
    }
  };

  // Format date for preview
  const formatEventDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return dateStr;
    }
  };

  // Handle region change
  const onRegionChange = (newRegion: Region) => {
    setRegion(newRegion);
  };

  // Handle navigation trigger from events tab
  useEffect(() => {
    if (filters.shouldNavigateToMap) {
      // Reset the navigation flag
      setShouldNavigateToMap(false);
      // The drawing mode should already be set, so the map will be in drawing mode
    }
  }, [filters.shouldNavigateToMap, setShouldNavigateToMap]);



  // Toggle filters application - clears all filters
  const toggleOffEventsFilters = () => {
    setSelectedTypes(['all']);
    setSelectedCity('all');
    setMapFilterEnabled(false);
    setPolygonCoords([]);
  };


  // Center map on current location
  const centerOnUserLocation = async () => {
    if (!mapRef.current) return;

    try {
      const currentLocation = await Location.getCurrentPositionAsync({});
      setLocation(currentLocation);
      
      const newRegion = {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        latitudeDelta: 0.03,
        longitudeDelta: 0.03,
      };
      
      setRegion(newRegion);
      mapRef.current.animateToRegion(newRegion, 1000);
    } catch (error) {
      console.error("Failed to get current location:", error);
    }
  };

  // State to track touch gestures with tolerance
  const [touchCount, setTouchCount] = useState(0);
  const [firstTouchTime, setFirstTouchTime] = useState(0);
  const [isMultiTouch, setIsMultiTouch] = useState(false);
  const touchTimeoutRef = useRef<number | null>(null);

  // Multi-touch tolerance in milliseconds
  const MULTI_TOUCH_TOLERANCE = 200;

  // Handle touch start - track number of fingers with tolerance
  const handleTouchStart = (event: any) => {
    const touches = event.nativeEvent.touches?.length || 0;
    const currentTime = Date.now();
    
    setTouchCount(touches);
    
    if (touches === 1) {
      // First finger down - start tolerance timer
      setFirstTouchTime(currentTime);
      setIsMultiTouch(false);
      
      // Clear any existing timeout
      if (touchTimeoutRef.current) {
        clearTimeout(touchTimeoutRef.current);
      }
      
      // Set a timeout to confirm single touch
      touchTimeoutRef.current = setTimeout(() => {
        if (touchCount === 1) {
          setIsMultiTouch(false);
        }
      }, MULTI_TOUCH_TOLERANCE);
      
    } else if (touches >= 2) {
      // Multiple fingers detected
      setIsMultiTouch(true);
      
      // Clear the single touch timeout
      if (touchTimeoutRef.current) {
        clearTimeout(touchTimeoutRef.current);
      }
    }
  };

  // Handle touch end - reset touch count with tolerance
  const handleTouchEnd = (event: any) => {
    const touches = event.nativeEvent.touches?.length || 0;
    setTouchCount(touches);
    
    if (touches === 0) {
      // All fingers lifted - reset state
      setIsMultiTouch(false);
      setFirstTouchTime(0);
      
      if (touchTimeoutRef.current) {
        clearTimeout(touchTimeoutRef.current);
      }
    }
  };

  // Continue drawing as finger moves - only with confirmed single finger
  const handleMapPanDrag = (event: any) => {
    if (filters.drawingMode && touchCount === 1 && !isMultiTouch) {
      const { coordinate } = event.nativeEvent;
      setPolygonCoords([...filters.polygonCoords, coordinate]);
    }
  };

  // Clear the current drawing (but stay in drawing mode)
  const clearDrawing = () => {
    setPolygonCoords([]);
  };

  // Cancel drawing mode and clear everything
  const cancelDrawing = () => {
    setPolygonCoords([]);
    setDrawingMode(false);
  };

  // Apply the drawn area as a zone filter
  const applyDrawnArea = () => {
    setMapFilterEnabled(true);
    setDrawingMode(false);
    // The current polygon becomes the active filter area
  };

  // Toggle events visibility
  const toggleEventsVisibility = () => {
    setShowEvents(!showEvents);
  };





  return (
    <View style={styles.container}>
      <StatusBar style={Platform.OS === 'ios' ? 'light' : 'auto'} />
      
      {location ? (
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          showsUserLocation
          showsMyLocationButton={false}
          initialRegion={{
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            latitudeDelta: 0.03,
            longitudeDelta: 0.03,
          }}
          onRegionChangeComplete={onRegionChange}
          onPanDrag={handleMapPanDrag}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          scrollEnabled={!filters.drawingMode || (filters.drawingMode && touchCount >= 2)}
          zoomEnabled={true}
          rotateEnabled={!filters.drawingMode}
          pitchEnabled={!filters.drawingMode}
        >
          {/* Event markers */}
          {showEvents && filteredEvents
            .map(event => {
              // Use coordinates from event or get default coordinates for the city
              let coordinates = event.coordinates;
              if (!coordinates && event.city) {
                coordinates = getCityDefaultCoordinates(event.city) || undefined;
              }
              
              // Only render if we have coordinates (either from event or default)
              return coordinates ? (
                <Marker
                  key={event.id}
                  coordinate={coordinates}
                  pinColor={Colors[colorScheme ?? 'light'].tint}
                  onPress={() => handleEventPress(event)}
                />
              ) : null;
            })
            .filter(Boolean) // Remove null entries
          }
          
          {/* Current drawing polygon */}
          {filters.polygonCoords.length > 2 && (
            <Polygon
              coordinates={filters.polygonCoords}
              strokeWidth={2}
              strokeColor={Colors[colorScheme ?? 'light'].tint}
              fillColor={`${Colors[colorScheme ?? 'light'].tint}50`}
            />
          )}
          
          {/* Current drawing path */}
          {filters.drawingMode && filters.polygonCoords.length > 1 && (
            <Polyline
              coordinates={filters.polygonCoords}
              strokeWidth={3}
              strokeColor={Colors[colorScheme ?? 'light'].tint}
            />
          )}
        </MapView>
      ) : (
        <View style={styles.loadingContainer}>
          <Text>Loading map...</Text>
        </View>
      )}

      {/* Custom recenter button */}
      <TouchableOpacity 
        style={styles.recenterButton}
        onPress={centerOnUserLocation}
      >
        <View style={styles.recenterButtonInner}>
          <IconSymbol size={24} name="location.fill" color={Colors[colorScheme ?? 'light'].tint} />
        </View>
      </TouchableOpacity>

      {/* Event toggle button */}
      <TouchableOpacity 
        style={[styles.eventToggleButton, { backgroundColor: showEvents ? '#808080' : Colors[colorScheme ?? 'light'].tint }]}
        onPress={toggleEventsVisibility}
      >
        <IconSymbol size={20} name="calendar.badge.clock" color="#fff" />
        <Text style={styles.eventToggleText}>{showEvents ? 'Hide events' : 'Events Hiden'}</Text>
      </TouchableOpacity>

      {/* Drawing controls - now controlled from Events tab */}
      {filters.drawingMode && (
        <View style={[styles.controlsContainer, { paddingBottom: insets.bottom + 70 }]}>
          {filters.polygonCoords.length > 2 && (
            <TouchableOpacity style={[styles.controlButton,
              {backgroundColor: Colors[colorScheme ?? 'light'].tint}
              ]}
              onPress={applyDrawnArea}
            >
              <IconSymbol 
                size={24} 
                name="checkmark" 
                color="#fff" 
              />
              <Text style={styles.buttonText}>
                Apply
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.controlButton, { backgroundColor: '#6B7280' }]}
            onPress={clearDrawing}
          >
            <IconSymbol size={24} name="trash" color="#fff" />
            <Text style={styles.buttonText}>Clear</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.controlButton, { backgroundColor: '#DC2626' }]}
            onPress={cancelDrawing}
          >
            <IconSymbol size={24} name="xmark" color="#fff" />
            <Text style={styles.buttonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Event filter toggle button - only clickable when filters are active */}
      <TouchableOpacity
        style={[
          styles.filterToggleButton, 
          { 
            backgroundColor: hasActiveFilters() ? Colors[colorScheme ?? 'light'].tint : '#808080',
            opacity: hasActiveFilters() ? 1 : 0.6
          }
        ]}
        onPress={hasActiveFilters() ? toggleOffEventsFilters : undefined}
        disabled={!hasActiveFilters()}
      >
        <IconSymbol size={20} name="line.3.horizontal.decrease" color="#fff" />
        <Text style={styles.eventToggleText}>
          {hasActiveFilters() ? 'Filters On' : 'All Events'}
        </Text>
      </TouchableOpacity>

      {/* Event Preview Modal */}
      {showEventPreview && selectedEvent && (
        <Animated.View
          style={[
            styles.eventPreviewContainer,
            {
              transform: [
                {
                  translateY: previewAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-400, 0],
                  }),
                },
              ],
              opacity: previewAnimation,
            },
          ]}
        >
          {/* Backdrop - clicking closes modal */}
          <TouchableOpacity 
            style={styles.backdrop}
            onPress={hideEventPreviewModal}
            activeOpacity={1}
          />
          
          <View style={[styles.eventPreview, { marginTop: insets.top + 10 }]}>
            <TouchableOpacity 
              style={styles.eventPreviewContent}
              onPress={navigateToEventDetails}
              activeOpacity={0.9}
            >
              {/* Close button */}
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={hideEventPreviewModal}
              >
                <IconSymbol name="xmark" size={20} color="#666" />
              </TouchableOpacity>

              {/* Event Image */}
              {selectedEvent.image ? (
                <Image 
                  source={{ uri: selectedEvent.image }} 
                  style={styles.eventPreviewImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.eventPreviewImagePlaceholder}>
                  <IconSymbol name="photo" size={40} color="#999" />
                </View>
              )}

              {/* Event Details */}
              <View style={styles.eventPreviewContentInner}>
                <View style={styles.eventPreviewHeader}>
                  <Text style={styles.eventPreviewType}>
                    {eventTypeIcons[selectedEvent.type]} {selectedEvent.type}
                  </Text>
                  <Text style={styles.eventPreviewTitle} numberOfLines={2}>
                    {selectedEvent.title}
                  </Text>
                </View>

                <View style={styles.eventPreviewDetails}>
                  <View style={styles.eventPreviewRow}>
                    <IconSymbol name="calendar" size={16} color="#666" />
                    <Text style={styles.eventPreviewText}>
                      {selectedEvent.schedule.length > 0 && selectedEvent.schedule[0] && selectedEvent.schedule[0].date
                        ? formatEventDate(selectedEvent.schedule[0].date)
                        : 'Date TBA'
                      }
                    </Text>
                  </View>

                  <View style={styles.eventPreviewRow}>
                    <IconSymbol name="mappin" size={16} color="#666" />
                    <Text style={styles.eventPreviewText} numberOfLines={1}>
                      {selectedEvent.location 
                        ? `${selectedEvent.location}, ${selectedEvent.city}`
                        : selectedEvent.city
                      }
                    </Text>
                  </View>

                  <View style={styles.eventPreviewRow}>
                    <IconSymbol name="person" size={16} color="#666" />
                    <Text style={styles.eventPreviewText}>
                      {selectedEvent.organizer.name}
                    </Text>
                  </View>
                </View>

                <Text style={styles.tapToViewText}>Tap to view full details</Text>
              </View>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    padding: 16,
    gap: 10,
  },
  controlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    gap: 6,
    backgroundColor: 'rgba(255,0,0,0.2)',
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  eventToggleButton: {
    position: 'absolute',
    top: 50,
    right: 15,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4C8BF5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  eventToggleText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  recenterButton: {
    position: 'absolute',
    right: 20,
    bottom: 100,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  recenterButtonInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterToggleButton: {
    position: 'absolute',
    top: 50,
    left: 15,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  // Event Preview Styles
  eventPreviewContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    justifyContent: 'flex-start',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  eventPreview: {
    marginHorizontal: 16,
    height: '55%',
    backgroundColor: 'white',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
    overflow: 'hidden',
  },
  eventPreviewContent: {
    flex: 1,
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  eventPreviewImage: {
    width: '100%',
    height: '60%',
  },
  eventPreviewImagePlaceholder: {
    width: '100%',
    height: '60%',
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  eventPreviewContentInner: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between',
  },
  eventPreviewHeader: {
    marginBottom: 12,
  },
  eventPreviewType: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
    textTransform: 'capitalize',
  },
  eventPreviewTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    lineHeight: 24,
  },
  eventPreviewDetails: {
    gap: 8,
  },
  eventPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eventPreviewText: {
    fontSize: 14,
    color: '#555',
    flex: 1,
  },
  tapToViewText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
});