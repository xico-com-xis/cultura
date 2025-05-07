import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useEvents } from '@/context/EventContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Callout, Marker, Polygon, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function MapScreen() {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [drawingMode, setDrawingMode] = useState(false);
  const [polygonCoords, setPolygonCoords] = useState<Array<{ latitude: number; longitude: number }>>([]);
  const [savedPolygons, setSavedPolygons] = useState<Array<Array<{ latitude: number; longitude: number }>>>([]);
  const { events } = useEvents();
  const [showEvents, setShowEvents] = useState(true);

  // Request location permissions and get current location
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('Permission to access location was denied');
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({});
      setLocation(currentLocation);
    })();
  }, []);

  // Center map on current location
  const centerOnUserLocation = async () => {
    if (!mapRef.current) return;

    try {
      const currentLocation = await Location.getCurrentPositionAsync({});
      setLocation(currentLocation);
      
      mapRef.current.animateToRegion({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        latitudeDelta: 0.03,
        longitudeDelta: 0.03,
      }, 1000);
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
          onPanDrag={handleMapPanDrag}
          scrollEnabled={!drawingMode}
          zoomEnabled={!drawingMode}
          rotateEnabled={!drawingMode}
          pitchEnabled={!drawingMode}
        >
          {/* Event markers */}
          {showEvents && events.map(event => event.coordinates && (
            <Marker
              key={event.id}
              coordinate={event.coordinates}
              title={event.title}
              description={event.date}
              pinColor={Colors[colorScheme ?? 'light'].tint}
            >
              <Callout tooltip>
                <View style={styles.calloutView}>
                  <Text style={styles.calloutTitle}>{event.title}</Text>
                  <Text style={styles.calloutDetails}>{event.date}</Text>
                  <Text style={styles.calloutDetails}>{event.location}</Text>
                  <Text style={styles.calloutDescription}>{event.description}</Text>
                </View>
              </Callout>
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
        style={[styles.eventToggleButton, { backgroundColor: showEvents ? Colors[colorScheme ?? 'light'].tint : '#808080' }]}
        onPress={toggleEventsVisibility}
      >
        <IconSymbol size={20} name="calendar.badge.clock" color="#fff" />
        <Text style={styles.eventToggleText}>{showEvents ? 'Hide Events' : 'Show Events'}</Text>
      </TouchableOpacity>

      {/* Drawing controls */}
      <View style={[styles.controlsContainer, { paddingBottom: insets.bottom + 70 }]}>
        <TouchableOpacity
          style={[
            styles.controlButton,
            { backgroundColor: drawingMode ? 'rgba(255,0,0,0.2)' : Colors[colorScheme ?? 'light'].tabIconDefault }
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
    padding: 10,
    maxWidth: 200,
    borderColor: '#ccc',
    borderWidth: 1,
  },
  calloutTitle: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 4,
  },
  calloutDetails: {
    fontSize: 12,
    color: '#666',
  },
  calloutDescription: {
    marginTop: 4,
    fontSize: 12,
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
  }
});