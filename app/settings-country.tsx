import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useEvents } from '@/context/EventsContext';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function CountrySelectionScreen() {
  const { filters, availableCountries, setSelectedCountry } = useEvents();
  const colorScheme = useColorScheme();

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
    router.back();
  };

  return (
    <>
      <Stack.Screen 
        options={{
          headerShown: false,
        }} 
      />
      <ThemedView style={styles.container}>
        <ThemedView style={styles.header}>
          <TouchableOpacity 
            style={styles.headerBackButton}
            onPress={() => router.back()}
          >
            <IconSymbol name="chevron.left" size={24} color={Colors[colorScheme ?? 'light'].tint} />
          </TouchableOpacity>
          <ThemedText style={styles.headerTitle}>Select Country</ThemedText>
          <View style={{ width: 40 }} />
        </ThemedView>

        <ThemedView style={styles.content}>
          <ThemedView style={styles.descriptionContainer}>
            <ThemedText style={styles.description}>
              Choose your preferred country to see events from that region. This will filter events and adjust the available cities.
            </ThemedText>
          </ThemedView>

          <ScrollView style={styles.countryList} showsVerticalScrollIndicator={false}>
            {availableCountries.map((country) => (
              <TouchableOpacity
                key={country}
                style={[
                  styles.countryListItem,
                  country === filters.selectedCountry && styles.selectedCountryItem
                ]}
                onPress={() => handleCountrySelect(country)}
              >
                <View style={styles.countryItemContent}>
                  <ThemedText style={[
                    styles.countryItemText,
                    country === filters.selectedCountry && styles.selectedCountryText
                  ]}>
                    {countryFlags[country] || '🌍'} {country}
                  </ThemedText>
                  {country === filters.selectedCountry && (
                    <IconSymbol name="checkmark" size={20} color="#fff" />
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </ThemedView>
      </ThemedView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 50,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerBackButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  descriptionContainer: {
    padding: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    borderRadius: 12,
    marginBottom: 24,
  },
  description: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    textAlign: 'center',
  },
  countryList: {
    flex: 1,
  },
  countryListItem: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: 'rgba(255, 255, 255, 1)',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
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
    fontWeight: '500',
  },
  selectedCountryText: {
    color: '#fff',
    fontWeight: '600',
  },
});