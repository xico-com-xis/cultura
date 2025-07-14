import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { FlatList, Modal, StyleSheet, TouchableOpacity, View } from 'react-native';

import EventCard from '@/components/EventCard';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { EventType, useEvents } from '@/context/EventsContext';
import { useColorScheme } from '@/hooks/useColorScheme';

// Event type options with emoji icons
const eventTypeOptions: Array<{ type: EventType | 'all'; label: string; icon: string }> = [
  { type: 'all', label: 'All', icon: '🗓️' },
  { type: 'music', label: 'Music', icon: '🎵' },
  { type: 'art', label: 'Art', icon: '🎨' },
  { type: 'theater', label: 'Theater', icon: '🎭' },
  { type: 'dance', label: 'Dance', icon: '💃' },
  { type: 'workshop', label: 'Workshop', icon: '🛠️' },
  { type: 'festival', label: 'Festival', icon: '🎪' },
  { type: 'exhibition', label: 'Exhibition', icon: '🖼️' },
  { type: 'film', label: 'Film', icon: '🎬' },
  { type: 'literature', label: 'Literature', icon: '📚' },
  { type: 'other', label: 'Other', icon: '🔖' }
];

export default function EventsScreen() {
  // Use filtered events and filter methods from context
  const { 
    filteredEvents, 
    filters, 
    setSelectedTypes, 
    setMapFilterEnabled, 
    setDrawingMode,
    setSelectedCity,
    setShouldNavigateToMap,
    availableCities
  } = useEvents();
  const colorScheme = useColorScheme();
  const navigation = useNavigation();
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  
  // Add temporary state variables for the modal
  const [tempSelectedTypes, setTempSelectedTypes] = useState<Array<EventType | 'all'>>(['all']);
  const [tempSelectedCity, setTempSelectedCity] = useState<string>('all');

  const [mapModalVisible, setMapModalVisible] = useState(false);

  const openMapModal = () => {
    setTempSelectedCity(filters.selectedCity);
    setMapModalVisible(true);
  };
  
  // Update temporary filter states when modal opens
  const openFilterModal = () => {
    setTempSelectedTypes([...filters.selectedTypes]);
    setFilterModalVisible(true);
  };
  
  // Apply filters and close modal
  const applyFilters = () => {
    setSelectedTypes([...tempSelectedTypes]);
    setFilterModalVisible(false);
  };

  // Apply zone filters and close modal
  const applyZoneFilters = () => {
    setSelectedCity(tempSelectedCity);
    setMapModalVisible(false);
  };

  // Handle draw area button press
  const handleDrawArea = () => {
    if (filters.drawingMode) {
      // If drawing mode is active, cancel it
      setDrawingMode(false);
    } else {
      // If drawing mode is not active, start it
      setDrawingMode(true);
      setShouldNavigateToMap(true);
      setMapModalVisible(false);
      
      // Automatically navigate to map tab
      navigation.navigate('map' as never);
    }
  };
  
  // Check if category filters are active
  const areCategoryFiltersActive = () => {
    return !(filters.selectedTypes.length === 1 && filters.selectedTypes.includes('all'));
  };

  // Check if zone filters are active
  const areZoneFiltersActive = () => {
    return filters.mapFilterEnabled || filters.selectedCity !== 'all' || filters.drawingMode;
  };

  // Check if any filters are active (for overall logic)
  const areFiltersActive = () => {
    return areCategoryFiltersActive() || areZoneFiltersActive();
  };
  
  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.header}>
        <View style={styles.headerActions}>
          {/* Filter button */}
          <TouchableOpacity 
            style={[
              styles.filterButtonType,
              // Apply colored background when category filters are active
              areCategoryFiltersActive() && {
                backgroundColor: Colors[colorScheme ?? 'light'].tint,
                borderColor: Colors[colorScheme ?? 'light'].tint,
              }
            ]}
            onPress={openFilterModal}
          >
            <IconSymbol 
              name="line.3.horizontal.decrease" 
              size={20} 
              // Change icon color to white when category filters are active
              color={areCategoryFiltersActive() 
                ? '#fff' 
                : Colors[colorScheme ?? 'light'].text} 
            />
            <ThemedText 
              style={[
                styles.filterButtonText,
                // Change text color to white when category filters are active
                areCategoryFiltersActive() && { color: '#fff' }
              ]}
            >
              Categoria
            </ThemedText>
          </TouchableOpacity>

          {/* Map button */}
          <TouchableOpacity 
            style={[
              styles.filterButtonMap,
              // Apply colored background when zone filters are active
              areZoneFiltersActive() && {
                backgroundColor: Colors[colorScheme ?? 'light'].tint,
                borderColor: Colors[colorScheme ?? 'light'].tint,
              }
            ]}
            onPress={openMapModal}
          >
            <ThemedText 
              style={[
                styles.filterButtonText,
                // Change text color to white when zone filters are active
                areZoneFiltersActive() && { color: '#fff' }
              ]}
            >
              Zona
            </ThemedText>
            <IconSymbol 
              name="line.3.horizontal.decrease" 
              size={20} 
              // Change icon color to white when zone filters are active
              color={areZoneFiltersActive() 
                ? '#fff' 
                : Colors[colorScheme ?? 'light'].text} 
            />
          </TouchableOpacity>
        </View>
      </ThemedView>
      
      <FlatList
        data={filteredEvents}
        renderItem={({ item }) => (
          <EventCard event={item} />
        )}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <ThemedView style={styles.emptyContainer}>
            <ThemedText style={styles.emptyText}>
              No events match your filters
            </ThemedText>
          </ThemedView>
        }
      />
      
      {/* Filter Modal */}
      <View 
        style={[
          styles.modalOverlay,
          filterModalVisible && { backgroundColor: 'rgb(0, 0, 0)' }
        ]}
        pointerEvents={filterModalVisible ? 'auto' : 'none'}
      ></View>
      <Modal
        animationType="slide"
        transparent={true}
        visible={filterModalVisible}
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <ThemedView style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText type="title" style={styles.modalTitle}>Filter Events</ThemedText>
              <TouchableOpacity 
                style={styles.typeButton}
                onPress={() => setFilterModalVisible(false)}
              >
                <IconSymbol name="xmark" size={24} color={Colors[colorScheme ?? 'light'].text} />
              </TouchableOpacity>
            </View>
            
            {/* Event Type Selection */}
            <ThemedText style={styles.filterSectionTitle}>Event Type</ThemedText>
            <View style={styles.filterOptionsGrid}>
              {eventTypeOptions.map((option) => (
                <TouchableOpacity 
                  key={option.type}
                  style={[
                    styles.filterOption,
                    tempSelectedTypes.includes(option.type) && {
                      backgroundColor: Colors[colorScheme ?? 'light'].tint,
                      borderColor: Colors[colorScheme ?? 'light'].tint,
                    }
                  ]}
                  onPress={() => {
                    // Toggle selection logic
                    if (option.type === 'all') {
                      // If "All" is selected, clear other selections
                      setTempSelectedTypes(['all']);
                    } else {
                      // Handle toggling of specific types
                      const newSelectedTypes = [...tempSelectedTypes];
                      
                      // Remove "all" when selecting specific types
                      if (newSelectedTypes.includes('all')) {
                        newSelectedTypes.splice(newSelectedTypes.indexOf('all'), 1);
                      }
                      
                      // Toggle the selected type
                      if (newSelectedTypes.includes(option.type)) {
                        // If already selected, remove it
                        newSelectedTypes.splice(newSelectedTypes.indexOf(option.type), 1);
                        
                        // If no types are selected, revert to "all"
                        if (newSelectedTypes.length === 0) {
                          newSelectedTypes.push('all');
                        }
                      } else {
                        // If not selected, add it
                        newSelectedTypes.push(option.type);
                      }
                      
                      setTempSelectedTypes(newSelectedTypes);
                    }
                  }}
                >
                  <ThemedText 
                    style={[
                      styles.filterOptionText, 
                      tempSelectedTypes.includes(option.type) && { color: '#fff' }
                    ]}
                  >
                    {option.icon} {option.label}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>
            
            {/* Apply Button */}
            <TouchableOpacity 
              style={styles.applyButton}
              onPress={applyFilters}
            >
              <ThemedText style={styles.applyButtonText}>Apply Filters</ThemedText>
            </TouchableOpacity>
          </ThemedView>
        </View>
      </Modal>

      {/* Map Modal */}
      <View 
        style={[
          styles.modalOverlay,
          mapModalVisible && { backgroundColor: 'rgb(0, 0, 0)' }
        ]}
        pointerEvents={mapModalVisible ? 'auto' : 'none'}
      ></View>
      <Modal
        animationType="slide"
        transparent={true}
        visible={mapModalVisible}
        onRequestClose={() => setMapModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <ThemedView style={styles.modalContent}>
            <ThemedText type="title" style={styles.modalTitle}>Zone Filter</ThemedText>
            <ThemedText style={styles.modalSubtitle}>Filter events by city or draw a custom area</ThemedText>
            
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => setMapModalVisible(false)}
            >
              <ThemedText style={styles.closeButtonText}>×</ThemedText>
            </TouchableOpacity>
            
            {/* City Filter Section */}
            <ThemedText style={styles.filterSectionTitle}>Filter by City</ThemedText>
            <View style={styles.filterOptionsGrid}>
              <TouchableOpacity 
                style={[
                  styles.filterOption,
                  tempSelectedCity === 'all' && {
                    backgroundColor: Colors[colorScheme ?? 'light'].tint,
                    borderColor: Colors[colorScheme ?? 'light'].tint,
                  }
                ]}
                onPress={() => setTempSelectedCity('all')}
              >
                <ThemedText 
                  style={[
                    styles.filterOptionText, 
                    tempSelectedCity === 'all' && { color: '#fff' }
                  ]}
                >
                  🌍 All Cities
                </ThemedText>
              </TouchableOpacity>
              
              {availableCities.map((city) => (
                <TouchableOpacity 
                  key={city}
                  style={[
                    styles.filterOption,
                    tempSelectedCity === city && {
                      backgroundColor: Colors[colorScheme ?? 'light'].tint,
                      borderColor: Colors[colorScheme ?? 'light'].tint,
                    }
                  ]}
                  onPress={() => setTempSelectedCity(city)}
                >
                  <ThemedText 
                    style={[
                      styles.filterOptionText, 
                      tempSelectedCity === city && { color: '#fff' }
                    ]}
                  >
                    📍 {city}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>

            {/* Area Drawing Section */}
            <ThemedText style={styles.filterSectionTitle}>Draw Custom Area</ThemedText>
            <TouchableOpacity 
              style={[
                styles.drawAreaButton,
                filters.drawingMode && styles.drawAreaButtonActive
              ]}
              onPress={handleDrawArea}
            >
              <IconSymbol 
                name={filters.drawingMode ? "xmark.circle" : "pencil"} 
                size={20} 
                color={filters.drawingMode ? '#DC2626' : Colors[colorScheme ?? 'light'].tint} 
              />
              <ThemedText style={[
                styles.drawAreaButtonText,
                filters.drawingMode && styles.drawAreaButtonTextActive
              ]}>
                {filters.drawingMode ? "Cancel Drawing Mode" : "Draw Area on Map"}
              </ThemedText>
            </TouchableOpacity>
            
            {/* Apply Button */}
            <TouchableOpacity 
              style={styles.applyButton}
              onPress={applyZoneFilters}
            >
              <ThemedText style={styles.applyButtonText}>Apply Zone Filter</ThemedText>
            </TouchableOpacity>
          </ThemedView>
        </View>
      </Modal>

    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 40,
    width: '100%', // Ensure header takes full width
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterButtonType: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 1,
    borderWidth: 1,
    borderRightWidth: 0,
    width: 110,
  },
  filterButtonMap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 2,
    borderWidth: 1,
    marginLeft: -1, 
    width: 110,
  },
  filterButtonText: {
    fontSize: 14,
    marginLeft: 6,
    marginRight: 6,
  },
  listContent: {
    paddingBottom: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 40,
  },
  emptyText: {
    textAlign: 'center',
    opacity: 0.6,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.5,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
  },
  typeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    marginRight: 8,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  filterOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 24,
  },
  filterOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    margin: 4,
  },
  filterOptionText: {
    fontSize: 14,
  },
  toggleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    marginBottom: 24,
  },
  toggleOptionText: {
    fontSize: 14,
    marginLeft: 8,
  },
  applyButton: {
    backgroundColor: Colors.light.tint,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  applyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  mapContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    height: 400,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    marginBottom: 20,
  },
  mapPlaceholder: {
    opacity: 0.6,
  },
  drawAreaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.tint,
    backgroundColor: 'transparent',
    marginBottom: 20,
    gap: 8,
  },
  drawAreaButtonText: {
    color: Colors.light.tint,
    fontSize: 16,
    fontWeight: '600',
  },
  drawAreaButtonActive: {
    borderColor: '#DC2626',
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
  },
  drawAreaButtonTextActive: {
    color: '#DC2626',
  },
  drawingModeIndicator: {
    backgroundColor: Colors.light.tint,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  drawingModeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 20,
    textAlign: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 15,
    right: 15,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#666',
  },
});