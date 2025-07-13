import { useState } from 'react';
import { Modal, StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useEvents } from '@/context/EventsContext';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function ProfileScreen() {
  const { filters, availableCountries, setSelectedCountry } = useEvents();
  const colorScheme = useColorScheme();
  const [countryModalVisible, setCountryModalVisible] = useState(false);

  // Country flag mapping
  const countryFlags: Record<string, string> = {
    'Portugal': '🇵🇹',
    'Spain': '🇪🇸',
    'France': '🇫🇷',
    'Italy': '🇮🇹',
    'Germany': '🇩🇪',
    'United Kingdom': '🇬🇧',
    'Netherlands': '🇳🇱',
    'Belgium': '🇧🇪',
  };

  const handleCountrySelect = (country: string) => {
    setSelectedCountry(country);
    setCountryModalVisible(false);
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.header}>
        <ThemedText type="title">Profile</ThemedText>
      </ThemedView>
      
      <ThemedView style={styles.profileInfo}>
        <ThemedText type="title">User Name</ThemedText>
        <ThemedText>user@example.com</ThemedText>
      </ThemedView>

      {/* Country Selection Section */}
      <ThemedView style={styles.section}>
        <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>Location Settings</ThemedText>
        <ThemedText style={styles.sectionDescription}>
          Select your country to see relevant events and cities in your area.
        </ThemedText>
        
        <TouchableOpacity 
          style={styles.countrySelector}
          onPress={() => setCountryModalVisible(true)}
        >
          <View style={styles.countrySelectorContent}>
            <View>
              <ThemedText style={styles.countryLabel}>Country</ThemedText>
              <ThemedText type="defaultSemiBold" style={styles.countryValue}>
                {countryFlags[filters.selectedCountry] || '🌍'} {filters.selectedCountry}
              </ThemedText>
            </View>
            <IconSymbol 
              name="chevron.right" 
              size={20} 
              color={Colors[colorScheme ?? 'light'].text} 
            />
          </View>
        </TouchableOpacity>
      </ThemedView>
      
      <ThemedView style={styles.section}>
        <ThemedText type="defaultSemiBold">My Events</ThemedText>
        <ThemedText>You haven't subscribed to any events yet.</ThemedText>
      </ThemedView>

      {/* Country Selection Modal */}
      <View 
        style={[
          styles.modalOverlay,
          countryModalVisible && { backgroundColor: 'rgb(0, 0, 0)' }
        ]}
        pointerEvents={countryModalVisible ? 'auto' : 'none'}
      ></View>
      <Modal
        animationType="slide"
        transparent={true}
        visible={countryModalVisible}
        onRequestClose={() => setCountryModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <ThemedView style={styles.modalContent}>
            <ThemedText type="title" style={styles.modalTitle}>Select Country</ThemedText>
            <ThemedText style={styles.modalSubtitle}>Choose your country to see relevant events</ThemedText>
            
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => setCountryModalVisible(false)}
            >
              <ThemedText style={styles.closeButtonText}>×</ThemedText>
            </TouchableOpacity>
            
            <View style={styles.countryList}>
              {availableCountries.map((item) => (
                <TouchableOpacity
                  key={item}
                  style={[
                    styles.countryListItem,
                    filters.selectedCountry === item && styles.selectedCountryItem
                  ]}
                  onPress={() => handleCountrySelect(item)}
                >
                  <View style={styles.countryItemContent}>
                    <ThemedText 
                      style={[
                        styles.countryItemText,
                        filters.selectedCountry === item && styles.selectedCountryText
                      ]}
                    >
                      {countryFlags[item] || '🌍'} {item}
                    </ThemedText>
                    {filters.selectedCountry === item && (
                      <IconSymbol name="checkmark" size={16} color="#fff" />
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
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
    marginTop: 40,
    marginBottom: 20,
  },
  profileInfo: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  section: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    marginBottom: 8,
  },
  sectionDescription: {
    marginBottom: 16,
    opacity: 0.8,
    lineHeight: 20,
  },
  countrySelector: {
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 8,
    padding: 12,
  },
  countrySelectorContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  countryLabel: {
    fontSize: 12,
    opacity: 0.6,
    marginBottom: 4,
  },
  countryValue: {
    fontSize: 16,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.5,
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
    textAlign: 'center',
    marginBottom: 8,
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
  countryList: {
    marginBottom: 24,
  },
  countryListItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  selectedCountryItem: {
    backgroundColor: Colors.light.tint,
    borderColor: Colors.light.tint,
  },
  countryItemContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  countryItemText: {
    fontSize: 16,
  },
  selectedCountryText: {
    color: '#fff',
    fontWeight: '600',
  },
});