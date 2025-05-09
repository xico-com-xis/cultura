import { useState } from 'react';
import { FlatList, Modal, StyleSheet, TouchableOpacity, View } from 'react-native';

import EventCard from '@/components/EventCard';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { EventType, useEvents } from '@/context/EventContext';
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
  const { events } = useEvents();
  const colorScheme = useColorScheme();
  const [selectedType, setSelectedType] = useState<EventType | 'all'>('all');
  const [mapFilterEnabled, setMapFilterEnabled] = useState(true);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  
  // Sort events by earliest date first
  const sortedEvents = [...events].sort((a, b) => {
    const aDate = a.schedule && a.schedule.length > 0 ? new Date(a.schedule[0].date) : new Date();
    const bDate = b.schedule && b.schedule.length > 0 ? new Date(b.schedule[0].date) : new Date();
    return aDate.getTime() - bDate.getTime();
  });
  
  // Filter events by type
  const filteredEvents = sortedEvents.filter(event => 
    selectedType === 'all' || event.type === selectedType
  );
  
  // Filter by map location - in a real app, this would use geolocation
  // This is a simplified version that just filters random events when enabled
  const displayedEvents = mapFilterEnabled 
    ? filteredEvents.filter((_, index) => index % 2 === 0) // Just a demo filter
    : filteredEvents;
  
  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.header}>
        <View style={styles.headerActions}>
          {/* Filter button */}
          <TouchableOpacity 
            style={styles.filterButton}
            onPress={() => setFilterModalVisible(true)}
          >
            <IconSymbol name="line.3.horizontal.decrease" size={20} color={Colors[colorScheme ?? 'light'].text} />
            <ThemedText style={styles.filterButtonText}>Filter</ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>
      
      <FlatList
        data={displayedEvents}
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
              <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
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
                    selectedType === option.type && {
                      backgroundColor: Colors[colorScheme ?? 'light'].tint,
                      borderColor: Colors[colorScheme ?? 'light'].tint,
                    }
                  ]}
                  onPress={() => {
                    setSelectedType(option.type);
                    setFilterModalVisible(false);
                  }}
                >
                  <ThemedText 
                    style={[
                      styles.filterOptionText, 
                      selectedType === option.type && { color: '#fff' }
                    ]}
                  >
                    {option.icon} {option.label}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>
            
            {/* Location Filter */}
            <ThemedText style={styles.filterSectionTitle}>Location</ThemedText>
            <TouchableOpacity 
              style={[
                styles.toggleOption,
                mapFilterEnabled && {
                  backgroundColor: Colors[colorScheme ?? 'light'].tint,
                  borderColor: Colors[colorScheme ?? 'light'].tint,
                }
              ]}
              onPress={() => setMapFilterEnabled(!mapFilterEnabled)}
            >
              <IconSymbol 
                name="mappin.and.ellipse" 
                size={18} 
                color={mapFilterEnabled ? '#fff' : Colors[colorScheme ?? 'light'].text} 
              />
              <ThemedText 
                style={[
                  styles.toggleOptionText,
                  mapFilterEnabled && { color: '#fff' }
                ]}
              >
                Show nearby events only (15km radius)
              </ThemedText>
            </TouchableOpacity>
            
            {/* Apply Button */}
            <TouchableOpacity 
              style={styles.applyButton}
              onPress={() => setFilterModalVisible(false)}
            >
              <ThemedText style={styles.applyButtonText}>Apply Filters</ThemedText>
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
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    marginRight: 8,
  },
  filterButtonText: {
    fontSize: 14,
    marginLeft: 6,
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
});