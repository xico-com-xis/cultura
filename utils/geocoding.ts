import * as Location from 'expo-location';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * Geocodes an address string to get coordinates
 * @param address Full address string (e.g., "Rua da Prata 80, Lisboa, Portugal")
 * @returns Promise with coordinates or null if failed
 */
export const geocodeAddress = async (address: string): Promise<Coordinates | null> => {
  try {
    // Check if location permissions are granted
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.warn('Location permission not granted, skipping geocoding');
      return null;
    }

    // Use Expo's geocoding service
    const geocodedLocations = await Location.geocodeAsync(address);
    
    if (geocodedLocations && geocodedLocations.length > 0) {
      const location = geocodedLocations[0];
      return {
        latitude: location.latitude,
        longitude: location.longitude,
      };
    }
    
    return null;
  } catch (error) {
    console.error('Geocoding failed:', error);
    return null;
  }
};

/**
 * Creates a full address string from location components
 * @param location Location name/address
 * @param city City name
 * @param country Country name
 * @returns Formatted address string
 */
export const createFullAddress = (location: string, city: string, country: string): string => {
  return `${location}, ${city}, ${country}`.trim();
};

/**
 * Default coordinates for major cities as fallback
 */
export const getCityDefaultCoordinates = (city: string): Coordinates | null => {
  const cityCoords: Record<string, Coordinates> = {
    // Portugal
    'Lisboa': { latitude: 38.7223, longitude: -9.1393 },
    'Porto': { latitude: 41.1579, longitude: -8.6291 },
    'Braga': { latitude: 41.5454, longitude: -8.4265 },
    'Coimbra': { latitude: 40.2033, longitude: -8.4103 },
    'Faro': { latitude: 37.0194, longitude: -7.9322 },
    'Aveiro': { latitude: 40.6443, longitude: -8.6455 },
    'Évora': { latitude: 38.5664, longitude: -7.9065 },
    'Viseu': { latitude: 40.6566, longitude: -7.9122 },
    
    // Spain
    'Madrid': { latitude: 40.4168, longitude: -3.7038 },
    'Barcelona': { latitude: 41.3851, longitude: 2.1734 },
    'Valencia': { latitude: 39.4699, longitude: -0.3763 },
    'Sevilla': { latitude: 37.3886, longitude: -5.9823 },
    'Bilbao': { latitude: 43.2627, longitude: -2.9253 },
    'Málaga': { latitude: 36.7213, longitude: -4.4214 },
    'Zaragoza': { latitude: 41.6488, longitude: -0.8891 },
    'Granada': { latitude: 37.1773, longitude: -3.5986 },
    
    // France
    'Paris': { latitude: 48.8566, longitude: 2.3522 },
    'Lyon': { latitude: 45.7640, longitude: 4.8357 },
    'Marseille': { latitude: 43.2965, longitude: 5.3698 },
    'Toulouse': { latitude: 43.6047, longitude: 1.4442 },
    'Nice': { latitude: 43.7102, longitude: 7.2620 },
    'Nantes': { latitude: 47.2184, longitude: -1.5536 },
    'Strasbourg': { latitude: 48.5734, longitude: 7.7521 },
    'Bordeaux': { latitude: 44.8378, longitude: -0.5792 },
    
    // Italy
    'Roma': { latitude: 41.9028, longitude: 12.4964 },
    'Milano': { latitude: 45.4642, longitude: 9.1900 },
    'Napoli': { latitude: 40.8518, longitude: 14.2681 },
    'Torino': { latitude: 45.0703, longitude: 7.6869 },
    'Palermo': { latitude: 38.1157, longitude: 13.3615 },
    'Genova': { latitude: 44.4056, longitude: 8.9463 },
    'Bologna': { latitude: 44.4949, longitude: 11.3426 },
    'Firenze': { latitude: 43.7696, longitude: 11.2558 },
    
    // Germany
    'Berlin': { latitude: 52.5200, longitude: 13.4050 },
    'Hamburg': { latitude: 53.5511, longitude: 9.9937 },
    'München': { latitude: 48.1351, longitude: 11.5820 },
    'Köln': { latitude: 50.9375, longitude: 6.9603 },
    'Frankfurt': { latitude: 50.1109, longitude: 8.6821 },
    'Stuttgart': { latitude: 48.7758, longitude: 9.1829 },
    'Düsseldorf': { latitude: 51.2277, longitude: 6.7735 },
    'Dortmund': { latitude: 51.5136, longitude: 7.4653 },
    
    // United Kingdom
    'London': { latitude: 51.5074, longitude: -0.1278 },
    'Manchester': { latitude: 53.4808, longitude: -2.2426 },
    'Birmingham': { latitude: 52.4862, longitude: -1.8904 },
    'Glasgow': { latitude: 55.8642, longitude: -4.2518 },
    'Liverpool': { latitude: 53.4084, longitude: -2.9916 },
    'Edinburgh': { latitude: 55.9533, longitude: -3.1883 },
    'Bristol': { latitude: 51.4545, longitude: -2.5879 },
    'Cardiff': { latitude: 51.4816, longitude: -3.1791 },
    
    // Netherlands
    'Amsterdam': { latitude: 52.3676, longitude: 4.9041 },
    'Rotterdam': { latitude: 51.9225, longitude: 4.4792 },
    'Den Haag': { latitude: 52.0705, longitude: 4.3007 },
    'Utrecht': { latitude: 52.0907, longitude: 5.1214 },
    'Eindhoven': { latitude: 51.4416, longitude: 5.4697 },
    'Tilburg': { latitude: 51.5555, longitude: 5.0913 },
    'Groningen': { latitude: 53.2194, longitude: 6.5665 },
    'Almere': { latitude: 52.3508, longitude: 5.2647 },
    
    // Belgium
    'Brussels': { latitude: 50.8503, longitude: 4.3517 },
    'Antwerp': { latitude: 51.2194, longitude: 4.4025 },
    'Ghent': { latitude: 51.0543, longitude: 3.7174 },
    'Charleroi': { latitude: 50.4108, longitude: 4.4446 },
    'Liège': { latitude: 50.6326, longitude: 5.5797 },
    'Bruges': { latitude: 51.2093, longitude: 3.2247 },
    'Namur': { latitude: 50.4669, longitude: 4.8674 },
    'Leuven': { latitude: 50.8798, longitude: 4.7005 },
  };
  
  return cityCoords[city] || null;
};
