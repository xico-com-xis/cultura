import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point, polygon } from '@turf/helpers';
import React, { useMemo, useRef, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, Polygon } from 'react-native-maps';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';

// Sample event data - replace with your API call
const SAMPLE_EVENTS = [
  { id: 1, title: 'Art Exhibition', location: { latitude: 37.78825, longitude: -122.4324 } },
  { id: 2, title: 'Music Festival', location: { latitude: 37.79025, longitude: -122.4124 } },
  { id: 3, title: 'Cultural Workshop', location: { latitude: 37.78225, longitude: -122.4524 } },
  { id: 4, title: 'Poetry Reading', location: { latitude: 37.78625, longitude: -122.4224 } },
  { id: 5, title: 'Dance Performance', location: { latitude: 37.79325, longitude: -122.4354 } },
];

// Minimum distance between points (in degrees) to avoid too many points
const MIN_DISTANCE = 0.0004;

export default function MapScreen() {
  const [events, setEvents] = useState(SAMPLE_EVENTS);
  const [filteredEvents, setFilteredEvents] = useState(SAMPLE_EVENTS);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [drawMode, setDrawMode] = useState(false);
  const [coordinates, setCoordinates] = useState([]);
  const [polygonComplete, setPolygonComplete] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  const mapRef = useRef(null);
  const tempCoordinatesRef = useRef([]);
  const throttleTimerRef = useRef(null);

  // Calculate distance between two coordinates
  const getDistance = (coord1, coord2) => {
    if (!coord1 || !coord2) return Infinity;
    
    const latDiff = coord1.latitude - coord2.latitude;
    const lngDiff = coord1.longitude - coord2.longitude;
    return Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
  };

  // Modified drag handler for better performance
  const handleMapDrag = (e) => {
    if (drawMode) {
      const newCoord = e.nativeEvent.coordinate;
      console.log('Dragging...');
      
      // Store in temp ref first
      const lastCoord = tempCoordinatesRef.current.length > 0 
        ? tempCoordinatesRef.current[tempCoordinatesRef.current.length - 1] 
        : null;
      
      if (!lastCoord || getDistance(lastCoord, newCoord) > MIN_DISTANCE) {
        tempCoordinatesRef.current.push(newCoord);

        // Throttle state updates to reduce rendering frequency
        if (!throttleTimerRef.current) {
          throttleTimerRef.current = setTimeout(() => {
            setCoordinates([...tempCoordinatesRef.current]);
            throttleTimerRef.current = null;
          }, 30); // Update visual every 30ms
        }
      }
    }
  };
  
  // Start tracking when user touches down
  const handleMapPressIn = (e) => {
    // console.log('First point pressed');
    if (drawMode) {
      setIsDragging(true);    
    }
  };
  
  // Stop tracking when user lifts finger
  const handleMapPressOut = () => {
    if (drawMode) {
      setIsDragging(false);
    }
  };
  
  // Start tracking with clean slate
  const startDrawing = () => {
    setDrawMode(true);
    tempCoordinatesRef.current = [];
    setCoordinates([]);
    setPolygonComplete(false);
  };
  
  // Finish drawing with all collected points
  const finishDrawing = () => {
    if (tempCoordinatesRef.current.length >= 3) {
      // Make sure we have the final state
      setCoordinates([...tempCoordinatesRef.current]);
      setDrawMode(false);
      setPolygonComplete(true);
      
      // Clear any pending updates
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
        throttleTimerRef.current = null;
      }
      
      // Filter events inside polygon
      filterEventsInPolygon(tempCoordinatesRef.current);
    }
  };
  
  // Cancel drawing and clean up
  const cancelDrawing = () => {
    if (throttleTimerRef.current) {
      clearTimeout(throttleTimerRef.current);
      throttleTimerRef.current = null;
    }
    tempCoordinatesRef.current = [];
    setDrawMode(false);
    setCoordinates([]);
    setPolygonComplete(false);
    setFilteredEvents(events);
  };
  
  // Update filterEventsInPolygon to use provided coordinates or state
  const filterEventsInPolygon = (coords = coordinates) => {
    if (coords.length < 3) return;
    
    // Create a closed polygon (first and last point are the same)
    const closedCoords = [...coords, coords[0]];
    
    // Convert to GeoJSON format for turf.js
    const poly = polygon([[...closedCoords.map(c => [c.longitude, c.latitude])]]);
    
    // Filter events inside polygon
    const eventsInside = events.filter(event => {
      const pt = point([event.location.longitude, event.location.latitude]);
      return booleanPointInPolygon(pt, poly);
    });
    
    setFilteredEvents(eventsInside);
    setSelectedEvent(null);
  };

  // Memoize the polygon to prevent unnecessary rerenders
  const drawingPolygon = useMemo(() => {
    
    // Ensure the polygon is properly closed for visibility when finished
    const displayCoordinates = 
      (polygonComplete && coordinates.length >= 0)
        ? [...coordinates, coordinates[0]] 
        : coordinates;

    console.log('Drawing polygon:');

    return (
      <Polygon
        coordinates={displayCoordinates}
        strokeColor="#F00"
        fillColor="rgba(255,0,0,0.2)"
        strokeWidth={2}
        geodesic={true}
      />
    );
  }, [coordinates, polygonComplete]);

  return (
    <ThemedView style={styles.container}>
      <MapView 
        ref={mapRef}
        style={styles.map}
        onPanDrag={handleMapDrag}
        onTouchStart={handleMapPressIn}
        onTouchEnd={handleMapPressOut}
        initialRegion={{
          latitude: 37.78825,
          longitude: -122.4324,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        }}
        scrollEnabled={!drawMode}
        rotateEnabled={!drawMode}
        zoomEnabled={!drawMode}
      >
        {/* Display markers for filtered events */}
        {filteredEvents.map(event => (
          <Marker
            key={event.id}
            coordinate={event.location}
            title={event.title}
            onPress={() => setSelectedEvent(event)}
          />
        ))}
        
        {/* Display drawing polygon */}
        {drawingPolygon}
      </MapView>
      
      {/* Drawing controls */}
      <View style={styles.controls}>
        {!drawMode && !polygonComplete ? (
          <TouchableOpacity style={styles.button} onPress={startDrawing}>
            <ThemedText type="defaultSemiBold">Draw Search Area</ThemedText>
          </TouchableOpacity>
        ) : drawMode ? (
          <View style={styles.drawingControls}>
            <TouchableOpacity style={styles.button} onPress={finishDrawing}>
              <ThemedText type="defaultSemiBold">Finish Drawing</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={cancelDrawing}>
              <ThemedText type="defaultSemiBold">Cancel</ThemedText>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.button} onPress={cancelDrawing}>
            <ThemedText type="defaultSemiBold">Clear Search Area</ThemedText>
          </TouchableOpacity>
        )}
      </View>
      
      {/* Event info card */}
      {selectedEvent && (
        <ThemedView style={styles.eventCard}>
          <ThemedText type="title">{selectedEvent.title}</ThemedText>
          <ThemedText>Location: {selectedEvent.location.latitude.toFixed(4)}, {selectedEvent.location.longitude.toFixed(4)}</ThemedText>
        </ThemedView>
      )}
      
      {/* Instructions during draw mode */}
      {drawMode && (
        <ThemedView style={styles.instructions}>
          <ThemedText>Drag your finger across the map to draw a search area</ThemedText>
          <ThemedText>Points: {coordinates.length} (Need at least 3)</ThemedText>
        </ThemedView>
      )}
      
      {/* Results count */}
      {polygonComplete && (
        <ThemedView style={styles.resultsCount}>
          <ThemedText type="defaultSemiBold">
            {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''} found in this area
          </ThemedText>
        </ThemedView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  eventCard: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    padding: 15,
    borderRadius: 10,
  },
  controls: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  button: {
    backgroundColor: '#4285F4',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#E53935',
  },
  drawingControls: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  instructions: {
    position: 'absolute',
    top: 110,
    left: 20,
    right: 20,
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  resultsCount: {
    position: 'absolute',
    top: 110,
    alignSelf: 'center',
    padding: 10,
    borderRadius: 8,
  }
});