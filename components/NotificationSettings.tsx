import React from 'react';
import { View, StyleSheet, Switch, Alert } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useEvents } from '@/context/EventsContext';
import { useAuth } from '@/context/AuthContext';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function NotificationSettings() {
  const { user } = useAuth();
  const {
    favoriteState,
    updateGlobalNotificationSetting,
    isGlobalNotificationEnabled,
  } = useEvents();
  const colorScheme = useColorScheme();

  const handleToggle = async (notificationType: 'reminders' | 'updates' | 'changes', enabled: boolean) => {
    try {
      await updateGlobalNotificationSetting(notificationType, enabled);
    } catch (error) {
      console.error('Error updating notification setting:', error);
      Alert.alert(
        'Error',
        'Failed to update notification settings. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>
        Notification Settings
      </ThemedText>
      
      <ThemedText style={styles.description}>
        Choose what types of notifications you'd like to receive for your favorited events and people.
      </ThemedText>

      <View style={styles.settingsGroup}>
        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <ThemedText style={styles.settingTitle}>Event Reminders</ThemedText>
            <ThemedText style={styles.settingDescription}>
              Get reminded before your favorited events start
            </ThemedText>
          </View>
          <Switch
            value={isGlobalNotificationEnabled('reminders')}
            onValueChange={(enabled) => handleToggle('reminders', enabled)}
            trackColor={{
              false: Colors[colorScheme ?? 'light'].tabIconDefault,
              true: Colors[colorScheme ?? 'light'].tint,
            }}
            thumbColor={Colors[colorScheme ?? 'light'].background}
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <ThemedText style={styles.settingTitle}>Event Updates</ThemedText>
            <ThemedText style={styles.settingDescription}>
              Get notified when your favorited events are updated
            </ThemedText>
          </View>
          <Switch
            value={isGlobalNotificationEnabled('updates')}
            onValueChange={(enabled) => handleToggle('updates', enabled)}
            trackColor={{
              false: Colors[colorScheme ?? 'light'].tabIconDefault,
              true: Colors[colorScheme ?? 'light'].tint,
            }}
            thumbColor={Colors[colorScheme ?? 'light'].background}
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <ThemedText style={styles.settingTitle}>New Events</ThemedText>
            <ThemedText style={styles.settingDescription}>
              Get notified when people you follow create new events
            </ThemedText>
          </View>
          <Switch
            value={isGlobalNotificationEnabled('changes')}
            onValueChange={(enabled) => handleToggle('changes', enabled)}
            trackColor={{
              false: Colors[colorScheme ?? 'light'].tabIconDefault,
              true: Colors[colorScheme ?? 'light'].tint,
            }}
            thumbColor={Colors[colorScheme ?? 'light'].background}
          />
        </View>
      </View>

      <View style={styles.statsContainer}>
        <ThemedText style={styles.statsTitle}>Your Favorites</ThemedText>
        <ThemedText style={styles.statsText}>
          📅 {favoriteState.favoriteEvents.size} favorited events
        </ThemedText>
        <ThemedText style={styles.statsText}>
          👥 {favoriteState.favoritePeople.size} favorited people
        </ThemedText>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    marginBottom: 10,
  },
  description: {
    marginBottom: 30,
    opacity: 0.7,
    lineHeight: 20,
  },
  settingsGroup: {
    marginBottom: 30,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.2)',
  },
  settingInfo: {
    flex: 1,
    marginRight: 15,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    opacity: 0.7,
    lineHeight: 18,
  },
  statsContainer: {
    padding: 20,
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
    borderRadius: 10,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  statsText: {
    fontSize: 14,
    marginBottom: 5,
  },
});
