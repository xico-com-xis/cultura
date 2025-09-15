import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Animated, StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthContext';
import { NotificationType, useEvents } from '@/context/EventsContext';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function NotificationSettingsScreen() {
  const { 
    updateGlobalNotificationSetting, 
    isGlobalNotificationEnabled 
  } = useEvents();
  const { user } = useAuth();
  const colorScheme = useColorScheme();

  // Animation values for each toggle
  const toggleAnims = useState(() => {
    const anims: Record<string, Animated.Value> = {};
    ['reminders', 'updates', 'changes'].forEach(type => {
      anims[type] = new Animated.Value(0);
    });
    return anims;
  })[0];

  // Initialize toggle animations based on current state
  useEffect(() => {
    ['reminders', 'updates', 'changes'].forEach(type => {
      const isEnabled = isGlobalNotificationEnabled(type as NotificationType);
      toggleAnims[type].setValue(isEnabled ? 1 : 0);
    });
  }, []);

  const animateToggle = (type: NotificationType, toValue: number) => {
    Animated.spring(toggleAnims[type], {
      toValue,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start();
  };

  const handleNotificationToggle = async (notificationType: NotificationType) => {
    try {
      const currentState = isGlobalNotificationEnabled(notificationType);
      const newState = !currentState;
      
      // If enabling notifications, check permissions first
      if (newState) {
        const permissionStatus = await checkAndRequestNotificationPermissions();
        if (!permissionStatus) {
          // User denied permissions, don't enable the toggle
          return;
        }
      }
      
      // Animate the toggle immediately for responsive feel
      animateToggle(notificationType, newState ? 1 : 0);
      
      await updateGlobalNotificationSetting(notificationType, newState);
    } catch (error) {
      // Revert animation on error
      const currentState = isGlobalNotificationEnabled(notificationType);
      animateToggle(notificationType, currentState ? 1 : 0);
      
      Alert.alert('Error', 'Failed to update notification settings');
      console.error('Notification toggle error:', error);
    }
  };

  const checkAndRequestNotificationPermissions = async (): Promise<boolean> => {
    try {
      // First check current permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      
      if (existingStatus === 'granted') {
        return true;
      }
      
      // If not granted, request permissions
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
      
      if (status === 'granted') {
        return true;
      }
      
      // Handle different denial scenarios
      if (status === 'denied') {
        Alert.alert(
          'Notifications Disabled',
          'To receive event notifications, please enable notifications in your device settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Open Settings', 
              onPress: () => {
                // On iOS/Android, we can't directly open notification settings
                // But we can show instructions
                Alert.alert(
                  'Enable Notifications',
                  'Go to Settings > Notifications > Cultura and enable notifications.',
                  [{ text: 'OK' }]
                );
              }
            }
          ]
        );
      } else {
        Alert.alert(
          'Notification Permission Required',
          'Please allow notifications to receive event updates and reminders.',
          [{ text: 'OK' }]
        );
      }
      
      return false;
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      Alert.alert(
        'Error',
        'Could not request notification permissions. Please check your device settings.'
      );
      return false;
    }
  };

  const notificationTypes: { type: NotificationType; label: string; description: string }[] = [
    { type: 'reminders', label: 'Event reminders', description: 'Get reminded before events you follow start' },
    { type: 'updates', label: 'Event updates', description: 'Get notified about updates to events you follow' },
    { type: 'changes', label: 'Schedule changes', description: 'Get notified when event times or venues change' },
  ];

  if (!user) {
    return (
      <>
        <Stack.Screen 
          options={{
            title: 'Notification Settings',
            headerBackTitle: 'Settings'
          }} 
        />
        <ThemedView style={styles.container}>
          <ThemedView style={styles.centerContent}>
            <IconSymbol name="person.circle" size={80} color="#ccc" />
            <ThemedText style={styles.emptyTitle}>Sign In Required</ThemedText>
            <ThemedText style={styles.emptyText}>
              Sign in to manage your notification settings
            </ThemedText>
          </ThemedView>
        </ThemedView>
      </>
    );
  }

  return (
    <>
      <Stack.Screen 
        options={{
          title: 'Notification Settings',
          headerBackTitle: 'Settings'
        }} 
      />
      <ThemedView style={styles.container}>
        <ThemedView style={styles.content}>
          <ThemedView style={styles.descriptionContainer}>
            <ThemedText style={styles.description}>
              These settings apply to all events you're following. Configure when you want to receive notifications about your followed events.
            </ThemedText>
          </ThemedView>

          {notificationTypes.map((notif) => (
            <ThemedView key={notif.type} style={styles.notificationItem}>
              <View style={styles.notificationContent}>
                <View style={styles.notificationText}>
                  <ThemedText style={styles.notificationLabel}>{notif.label}</ThemedText>
                  <ThemedText style={styles.notificationDescription}>
                    {notif.description}
                  </ThemedText>
                </View>
                <Animated.View
                  style={[
                    styles.notificationToggle,
                    {
                      backgroundColor: toggleAnims[notif.type].interpolate({
                        inputRange: [0, 1],
                        outputRange: ['#e0e0e0', Colors[colorScheme ?? 'light'].tint],
                      })
                    }
                  ]}
                >
                  <TouchableOpacity
                    style={styles.notificationToggleButton}
                    activeOpacity={0.8}
                    onPress={() => handleNotificationToggle(notif.type)}
                  >
                    <Animated.View 
                      style={[
                        styles.notificationToggleThumb,
                        {
                          transform: [{
                            translateX: toggleAnims[notif.type].interpolate({
                              inputRange: [0, 1],
                              outputRange: [0, 20],
                            })
                          }]
                        }
                      ]} 
                    />
                  </TouchableOpacity>
                </Animated.View>
              </View>
            </ThemedView>
          ))}

          <ThemedView style={styles.helpContainer}>
            <IconSymbol name="info.circle" size={20} color="#666" />
            <ThemedText style={styles.helpText}>
              You can also manage individual event notifications by hearting/unfollowing specific events.
            </ThemedText>
          </ThemedView>
        </ThemedView>
      </ThemedView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
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
  notificationItem: {
    paddingVertical: 20,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255, 255, 255, 1)',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  notificationText: {
    flex: 1,
    marginRight: 16,
  },
  notificationLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  notificationDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
  notificationToggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  notificationToggleButton: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingHorizontal: 2,
  },
  notificationToggleThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  helpContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    borderRadius: 12,
    marginTop: 24,
    gap: 12,
  },
  helpText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});