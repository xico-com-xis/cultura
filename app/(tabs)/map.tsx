import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Polygon, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function MapScreen() {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [drawingMode, setDrawingMode] = useState(false);
  const [polygonCoords, setPolygonCoords] = useState<Array<{ latitude: number; longitude: number }>>([]);
  const [savedPolygons, setSavedPolygons] = useState<Array<Array<{ latitude: number; longitude: number }>>>([]);

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

  return (
    <View style={styles.container}>
      <StatusBar style={Platform.OS === 'ios' ? 'light' : 'auto'} />
      
      {location ? (
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          showsUserLocation
          showsMyLocationButton
          initialRegion={{
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
          }}
          onPanDrag={handleMapPanDrag}
          scrollEnabled={!drawingMode}
          zoomEnabled={!drawingMode}
          rotateEnabled={!drawingMode}
          pitchEnabled={!drawingMode}
        >
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

      {/* Drawing mode indicator */}
      {drawingMode && (
        <View style={styles.drawingIndicator}>
          <Text style={styles.drawingIndicatorText}>Drawing Mode Active</Text>
          <Text style={styles.drawingHint}>Drag your finger to draw</Text>
        </View>
      )}

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
  }
});