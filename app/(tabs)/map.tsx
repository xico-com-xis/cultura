import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { Event, useEvents } from '@/context/EventsContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Callout, Marker, Polygon, Polyline, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Interface for clusters
interface Cluster {
  id: string;
  coordinate: { latitude: number; longitude: number };
  events: Event[];
  count: number;
}

export default function MapScreen() {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [drawingMode, setDrawingMode] = useState(false);
  const [polygonCoords, setPolygonCoords] = useState<Array<{ latitude: number; longitude: number }>>([]);
  const [savedPolygons, setSavedPolygons] = useState<Array<Array<{ latitude: number; longitude: number }>>>([]);
  const { events, filteredEvents, filters, setSelectedTypes, setMapFilterEnabled } = useEvents();
  const [showEvents, setShowEvents] = useState(true);
  const [useEventFilters, setUseEventFilters] = useState(true);
  
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

  // New state for clustering
  const [region, setRegion] = useState<Region>({
    latitude: 0,
    longitude: 0,
    latitudeDelta: 0.03,
    longitudeDelta: 0.03,
  });
  const [clusters, setClusters] = useState<Cluster[]>([]);



  // Clustering algorithm
  const clusterEvents = (currentEvents: any[], delta: number) => {
    if (!currentEvents || currentEvents.length === 0) return [];
    
    // Filter out events without coordinates
    const validEvents = currentEvents.filter(event => event.coordinates);
    if (validEvents.length === 0) return [];
    
    const zoomThreshold = 0.02; // At this zoom level or lower, don't cluster at all
    
    // If zoomed in enough, don't cluster at all
    if (delta <= zoomThreshold) {
      console.log(`Showing ${validEvents.length} individual markers`); // Debug logging
      return validEvents.map((event, index) => ({
        id: `single-${event.id}`,
        coordinate: { ...event.coordinates },
        events: [event],
        count: 1
      }));
    }
    
    // Otherwise use a very aggressive distance reduction for clustering
    const clusterDistance = delta * 15; // Drastically reduced from 40
    
    const clusters: Cluster[] = [];
    const processed: {[key: string]: boolean} = {};
    
    validEvents.forEach(event => {
      if (processed[event.id]) return;
      
      const cluster: Cluster = {
        id: `cluster-${clusters.length}`,
        coordinate: { ...event.coordinates },
        events: [event],
        count: 1
      };
      
      processed[event.id] = true;
      
      // Find nearby events to add to this cluster
      validEvents.forEach(otherEvent => {
        if (processed[otherEvent.id] || otherEvent.id === event.id) return;
        
        const distance = calculateDistance(
          event.coordinates.latitude,
          event.coordinates.longitude,
          otherEvent.coordinates.latitude,
          otherEvent.coordinates.longitude
        );
        
        if (distance <= clusterDistance) {
          cluster.events.push(otherEvent);
          cluster.count++;
          processed[otherEvent.id] = true;
          
          // Recalculate the center of the cluster (average of all coordinates)
          const totalLat = cluster.events.reduce((sum, e) => sum + e.coordinates.latitude, 0);
          const totalLng = cluster.events.reduce((sum, e) => sum + e.coordinates.longitude, 0);
          cluster.coordinate = {
            latitude: totalLat / cluster.events.length,
            longitude: totalLng / cluster.events.length
          };
        }
      });
      
      clusters.push(cluster);
    });
    
    return clusters;
  };

  // Handle cluster press - zoom in if multiple events
  const handleClusterPress = (cluster: Cluster) => {
    if (!mapRef.current || cluster.count <= 1) return;
    
    // Zoom in to see individual events
    mapRef.current.animateToRegion({
      latitude: cluster.coordinate.latitude,
      longitude: cluster.coordinate.longitude,
      latitudeDelta: Math.max(region.latitudeDelta / 10, 0.005),
      longitudeDelta: Math.max(region.longitudeDelta / 10, 0.005),
    }, 300);
    onRegionChange({
      latitude: cluster.coordinate.latitude,
      longitude: cluster.coordinate.longitude,
      latitudeDelta: Math.max(region.latitudeDelta / 10, 0.005),
      longitudeDelta: Math.max(region.longitudeDelta / 10, 0.005),
    });
  };

  // Handle region change - update clusters
  const onRegionChange = (newRegion: Region) => {
    setRegion(newRegion);

    if (showEvents && events.length > 0) {
      const eventsToCluster = useEventFilters ? filteredEvents : events;
      const newClusters = clusterEvents(eventsToCluster, newRegion.latitudeDelta);
      setClusters(newClusters);
    }
  };

  // Update clusters when events, showEvents, or region changes
  useEffect(() => {
    if (showEvents && events.length > 0) {
      const newClusters = clusterEvents(events, region.latitudeDelta);
      setClusters(newClusters);
    } else {
      setClusters([]);
    }
  }, [showEvents, events, region]);

  // Update clusters when showEvents, events, filteredEvents, region, useEventFilters change
  useEffect(() => {
    if (showEvents) { 
      // Use either all events or the filtered events based on the filter toggle
      const eventsToCluster = useEventFilters ? filteredEvents : events;
      const newClusters = clusterEvents(eventsToCluster, region.latitudeDelta);
      setClusters(newClusters);
    } else {
      setClusters([]);
    }
  }, [showEvents, events, filteredEvents, region, useEventFilters]);

  // Toggle filters application
  const toggleEventFilters = () => {
    setUseEventFilters(!useEventFilters);
    // Also sync with EventsContext - this will update filteredEvents
    if (!useEventFilters) {
      // When turning ON filters, make sure map filter is enabled in context
      setMapFilterEnabled(true);
    }
  };

  const handleIndividualEventPress = (event: Event) => {
    console.log('Individual event pressed:', event);
    console.log('Individual event pressed:', event.title);
    console.log('Individual event pressed:', event.description);
    console.log('Individual event pressed:', event.location);
    
    // You can add more functionality here, like:
    // - Navigate to event details page
    // - Show more information in a modal
    // - Highlight the event on the map
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

  // Continue drawing as finger moves
  const handleMapPanDrag = (event: any) => {
    if (drawingMode) {
      const { coordinate } = event.nativeEvent;
      setPolygonCoords(prev => [...prev, coordinate]);
    }
  };

  // Toggle drawing mode
  const toggleDrawingMode = () => {
    setDrawingMode(!drawingMode);
    if (drawingMode) {
      if(polygonCoords.length > 2) {
        // Save the current polygon and start a new one
        setSavedPolygons([...savedPolygons, polygonCoords]);
        setPolygonCoords([]);
      }
    }    
  };

  // Clear the current drawing
  const clearDrawing = () => {
    setPolygonCoords([]);
    setDrawingMode(false);
  };

  // Reset all saved drawings
  const resetAll = () => {
    setPolygonCoords([]);
    setSavedPolygons([]);
    setDrawingMode(false);
  };

  // Toggle events visibility
  const toggleEventsVisibility = () => {
    setShowEvents(!showEvents);
  };

  // Calculate distance between two coordinates (Haversine formula)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
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
          scrollEnabled={!drawingMode}
          zoomEnabled={!drawingMode}
          rotateEnabled={!drawingMode}
          pitchEnabled={!drawingMode}
        >
          {/* Event markers and clusters */}
          {showEvents && clusters.map(cluster => (
            <Marker
              key={cluster.id}
              coordinate={cluster.coordinate}
              pinColor={cluster.count === 1 ? Colors[colorScheme ?? 'light'].tint : undefined}
              onPress={() => cluster.count > 1 
                ? handleClusterPress(cluster) 
                : handleIndividualEventPress(cluster.events[0])
              }
            >
              {cluster.count > 1 ? (
                // Cluster marker stays the same
                <View style={[
                  styles.clusterMarker,
                  { 
                    backgroundColor: Colors[colorScheme ?? 'light'].tint,
                    width: Math.min(40 + (cluster.count * 2), 70),
                    height: Math.min(40 + (cluster.count * 2), 70),
                    borderRadius: Math.min(20 + (cluster.count * 1), 35),
                  }
                ]}>
                  <Text style={styles.clusterText}>{cluster.count}</Text>
                </View>
              ) : (
                // Just use the default pin with the callout
                <Callout tooltip>
                  <View style={styles.calloutView}>
                    <Text style={styles.calloutTitle}>
                      {cluster.events[0]?.title || 'Event'}
                    </Text>
                    <Text style={styles.calloutDetails}>
                      {cluster.events[0]?.location || 'Location not specified'}
                    </Text>
                    <Text style={styles.calloutDescription}>
                      {cluster.events[0]?.description || 'No description available'}
                    </Text>
                  </View>
                </Callout>
              )}
            </Marker>
          ))}
          
          {/* Current drawing polygon */}
          {polygonCoords.length > 2 && (
            <Polygon
              coordinates={polygonCoords}
              strokeWidth={2}
              strokeColor={Colors[colorScheme ?? 'light'].tint}
              fillColor={`${Colors[colorScheme ?? 'light'].tint}50`}
            />
          )}
          
          {/* Current drawing path */}
          {drawingMode && polygonCoords.length > 1 && (
            <Polyline
              coordinates={polygonCoords}
              strokeWidth={3}
              strokeColor={Colors[colorScheme ?? 'light'].tint}
            />
          )}
          
          {/* Saved polygons */}
          {savedPolygons.map((polygon, index) => (
            <Polygon
              key={index}
              coordinates={polygon}
              strokeWidth={2}
              strokeColor={Colors[colorScheme ?? 'light'].tabIconDefault}
              fillColor={`${Colors[colorScheme ?? 'light'].tabIconDefault}50`}
            />
          ))}
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

      {/* Drawing mode indicator */}
      {drawingMode && (
        <View style={styles.drawingIndicator}>
          <Text style={styles.drawingIndicatorText}>Drawing Mode Active</Text>
          <Text style={styles.drawingHint}>Drag your finger to draw</Text>
        </View>
      )}

      {/* Event toggle button */}
      <TouchableOpacity 
        style={[styles.eventToggleButton, { backgroundColor: showEvents ? '#808080' : Colors[colorScheme ?? 'light'].tint }]}
        onPress={toggleEventsVisibility}
      >
        <IconSymbol size={20} name="calendar.badge.clock" color="#fff" />
        <Text style={styles.eventToggleText}>{showEvents ? 'Hide events' : 'Events Hiden'}</Text>
      </TouchableOpacity>

      {/* Drawing controls */}
      <View style={[styles.controlsContainer, { paddingBottom: insets.bottom + 70 }]}>
        <TouchableOpacity style={[styles.controlButton,
          {backgroundColor: drawingMode ? 'rgba(255,0,0,0.2)' : Colors[colorScheme ?? 'light'].tabIconDefault}
          ]}
          onPress={toggleDrawingMode}
        >
          <IconSymbol 
            size={24} 
            name={drawingMode ? "checkmark" : "pencil"} 
            color="#fff" 
          />
          <Text style={styles.buttonText}>
            {drawingMode ? 'Save Area' : 'Draw Area'}
          </Text>
        </TouchableOpacity>

        {drawingMode && (
          <TouchableOpacity
            style={[styles.controlButton, { backgroundColor: 'rgb(255, 0, 0)' }]}
            onPress={clearDrawing}
          >
            <IconSymbol size={24} name="trash" color="#fff" />
            <Text style={styles.buttonText}>Clear</Text>
          </TouchableOpacity>
        )}

        {savedPolygons.length > 0 && (
          <TouchableOpacity
            style={[styles.controlButton, { backgroundColor: 'rgb(255, 0, 0)'}]}
            onPress={resetAll}
          >
            <IconSymbol size={24} name="arrow.counterclockwise" color="#fff" />
            <Text style={styles.buttonText}>Reset All</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Event filter toggle button */}
      <TouchableOpacity
        style={[
          styles.filterToggleButton, 
          { backgroundColor: useEventFilters ? Colors[colorScheme ?? 'light'].tint : '#808080' }
        ]}
        onPress={toggleEventFilters}
      >
        <IconSymbol size={20} name="line.3.horizontal.decrease" color="#fff" />
        <Text style={styles.eventToggleText}>
          {useEventFilters ? 'Filters On' : 'Filters Off'}
        </Text>
      </TouchableOpacity>

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
  drawingIndicator: {
    position: 'absolute',
    top: 10,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignItems: 'center',
  },
  drawingIndicatorText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  drawingHint: {
    color: '#ffffff',
    fontSize: 12,
    marginTop: 4,
  },
  calloutView: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    minWidth: 200,
    width: 250,
    maxWidth: 300,
    borderColor: '#ccc',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  calloutTitle: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 6,
    flexWrap: 'wrap',
  },
  calloutDetails: {
    fontSize: 13,
    color: '#444',
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  calloutDescription: {
    marginTop: 4,
    fontSize: 12,
    color: '#666',
    flexWrap: 'wrap',  
    lineHeight: 18,
    maxHeight: 72,     
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
  clusterMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  clusterText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  marker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
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
  }
});