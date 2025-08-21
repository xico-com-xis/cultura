import * as Location from 'expo-location';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface LocationSuggestion {
  id: string;
  displayName: string;
  fullAddress: string;
  coordinates: Coordinates;
  relevanceScore?: number;
}

/**
 * Gets location suggestions based on partial input, focusing on POI-type results
 * @param query Partial address or venue name
 * @param city City to search within
 * @param country Country to search within
 * @returns Promise with array of suggestions
 */
export const getLocationSuggestions = async (
  query: string, 
  city: string, 
  country: string
): Promise<LocationSuggestion[]> => {
  try {
    if (query.trim().length < 2) {
      return []; // Don't search for very short queries
    }

    // Check if location permissions are granted
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.warn('Location permission not granted, skipping location suggestions');
      return [];
    }

    const suggestions: LocationSuggestion[] = [];
    
    // Focus on POI-type searches similar to what appears on Google Maps
    const searchQueries: string[] = [];
    
    // POI categories that typically appear on Google Maps
    const poiTypes = [
      'restaurant', 'bar', 'cafe', 'hotel', 'museum', 'theater', 'cinema',
      'shopping', 'park', 'landmark', 'tourist attraction', 'hospital',
      'pharmacy', 'bank', 'gas station', 'airport', 'train station',
      'school', 'university', 'library', 'church', 'mosque', 'synagogue',
      'club', 'nightclub', 'gym', 'spa', 'beauty salon'
    ];
    
    const queryLower = query.toLowerCase().trim();
    
    if (city && city.trim() !== '') {
      // Primary searches - most likely to find POIs
      searchQueries.push(
        query, // Direct search (highest priority)
        `${query} ${city}`, // Name + city
      );
      
      // Add POI type searches if the query doesn't already contain them
      const containsPOIType = poiTypes.some(type => 
        queryLower.includes(type) || 
        type.includes(queryLower) ||
        // Portuguese equivalents
        (type === 'restaurant' && (queryLower.includes('restaurante') || queryLower.includes('tasca'))) ||
        (type === 'bar' && (queryLower.includes('taberna') || queryLower.includes('tasca'))) ||
        (type === 'museum' && queryLower.includes('museu')) ||
        (type === 'theater' && queryLower.includes('teatro')) ||
        (type === 'church' && queryLower.includes('igreja')) ||
        (type === 'hospital' && queryLower.includes('hospital')) ||
        (type === 'pharmacy' && queryLower.includes('farmácia')) ||
        (type === 'school' && queryLower.includes('escola')) ||
        (type === 'university' && queryLower.includes('universidade'))
      );
      
      if (!containsPOIType) {
        // Try with common POI types
        searchQueries.push(
          `${query} restaurant ${city}`,
          `${query} bar ${city}`,
          `${query} cafe ${city}`,
          `${query} museum ${city}`,
          `${query} hotel ${city}`
        );
      }
      
      // Location-based searches
      searchQueries.push(
        `${query} near ${city}`,
        `${query} in ${city}`
      );
    } else {
      // Broader searches for "Other" city
      searchQueries.push(
        query,
        `${query} ${country}`,
        `${query} restaurant`,
        `${query} bar`,
        `${query} museum`,
        `${query} landmark`
      );
    }

    // Limit to most relevant searches
    const limitedQueries = searchQueries.slice(0, 6);

    // Try each query variation
    for (const searchQuery of limitedQueries) {
      try {
        const geocodedLocations = await Location.geocodeAsync(searchQuery);
        
        if (geocodedLocations && geocodedLocations.length > 0) {
          // Process fewer results per query to get variety
          const limitedResults = geocodedLocations.slice(0, 3);
          
          for (let i = 0; i < limitedResults.length; i++) {
            const location = limitedResults[i];
            
            // Try to get a readable address using reverse geocoding
            let displayName = query;
            let fullAddress = searchQuery;
            
            try {
              const reverseGeocode = await Location.reverseGeocodeAsync({
                latitude: location.latitude,
                longitude: location.longitude,
              });
              
              if (reverseGeocode && reverseGeocode.length > 0) {
                const addr = reverseGeocode[0];
                
                // Enhanced POI name detection (similar to Google Maps POIs)
                let venueName = '';
                
                if (addr.name && addr.name !== addr.street && addr.name !== addr.city && addr.name !== addr.country) {
                  const name = addr.name.trim();
                  const nameLower = name.toLowerCase();
                  
                  // Prioritize names that match our query or seem like POI names
                  if (nameLower.includes(queryLower) || queryLower.includes(nameLower) || 
                      poiTypes.some(type => nameLower.includes(type))) {
                    venueName = name;
                  } else {
                    venueName = query.trim();
                  }
                } else {
                  venueName = query.trim();
                }
                
                displayName = venueName;
                
                // Build full address
                const fullParts = [venueName];
                if (addr.street && !venueName.toLowerCase().includes(addr.street.toLowerCase())) {
                  fullParts.push(addr.street);
                }
                if (addr.city || city) fullParts.push(addr.city || city);
                
                fullAddress = fullParts.join(', ');
              }
            } catch (reverseError) {
              console.log('Reverse geocoding failed, using original query');
            }

            // Calculate relevance score (prioritize POI-like results)
            let relevanceScore = 0;
            const displayNameLower = displayName.toLowerCase();
            
            // Higher score for exact matches
            if (displayNameLower === queryLower) relevanceScore += 10;
            else if (displayNameLower.includes(queryLower)) relevanceScore += 7;
            else if (queryLower.includes(displayNameLower)) relevanceScore += 5;
            
            // Bonus for POI indicators
            const hasPOIIndicators = poiTypes.some(type => 
              displayNameLower.includes(type) ||
              // Portuguese equivalents
              (type === 'restaurant' && displayNameLower.includes('restaurante')) ||
              (type === 'museum' && displayNameLower.includes('museu')) ||
              (type === 'theater' && displayNameLower.includes('teatro')) ||
              (type === 'church' && displayNameLower.includes('igreja'))
            );
            if (hasPOIIndicators) relevanceScore += 4;
            
            // Penalty for generic addresses
            const isGenericAddress = /^(rua|avenida|largo|praça|travessa|street|avenue|road)\s/i.test(displayNameLower);
            if (isGenericAddress) relevanceScore -= 3;
            
            // Bonus for first search result (direct query)
            if (searchQuery === query) relevanceScore += 2;

            const suggestion: LocationSuggestion = {
              id: `${location.latitude}_${location.longitude}_${i}_${relevanceScore}`,
              displayName: displayName,
              fullAddress: fullAddress,
              coordinates: {
                latitude: location.latitude,
                longitude: location.longitude,
              },
              relevanceScore: relevanceScore
            };

            // Filter duplicates and check country
            let isInCorrectCountry = true;
            if (country && country.trim() !== '') {
              try {
                const reverseGeocode = await Location.reverseGeocodeAsync({
                  latitude: location.latitude,
                  longitude: location.longitude,
                });
                
                if (reverseGeocode && reverseGeocode.length > 0) {
                  const addr = reverseGeocode[0];
                  const resultCountry = addr.country || '';
                  // Check if the result country matches the selected country (case insensitive)
                  isInCorrectCountry = resultCountry.toLowerCase().includes(country.toLowerCase()) ||
                                     country.toLowerCase().includes(resultCountry.toLowerCase());
                }
              } catch (filterError) {
                console.log('Country filtering failed, including result');
                // If filtering fails, assume it's in the correct country to avoid excluding valid results
                isInCorrectCountry = true;
              }
            }

            const isDuplicate = suggestions.some(existing => 
              Math.abs(existing.coordinates.latitude - suggestion.coordinates.latitude) < 0.001 &&
              Math.abs(existing.coordinates.longitude - suggestion.coordinates.longitude) < 0.001
            );

            if (!isDuplicate && isInCorrectCountry) {
              suggestions.push(suggestion);
            }
          }
        }
      } catch (queryError) {
        console.log(`Search query failed: ${searchQuery}`, queryError);
      }
      
      // Stop if we have enough good results
      if (suggestions.filter(s => (s.relevanceScore || 0) > 5).length >= 4) break;
    }

    // Sort by relevance score and return top results
    return suggestions
      .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
      .slice(0, 5);
    
  } catch (error) {
    console.error('Location suggestions failed:', error);
    return [];
  }
};

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
