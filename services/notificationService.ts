import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

// Your notification backend URL
const NOTIFICATION_BACKEND_URL = 'https://cultura-backend-231a858780cc.herokuapp.com';

// Get auth token for backend requests
async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('User not authenticated');
  }
  
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
  };
}

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Register for push notifications and send token to backend
 */
export async function registerForPushNotifications(userId: string) {
  if (!Device.isDevice) {
    console.log('Push notifications only work on physical devices');
    return null;
  }

  try {
    // Request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return null;
    }

    // Get the push token
    const token = await Notifications.getExpoPushTokenAsync({
      projectId: 'a5f748a9-5137-4dfb-838c-faaa71417090',
    });

    console.log('Push token:', token.data);

    // Send token to your notification backend
    const headers = await getAuthHeaders();
    await fetch(`${NOTIFICATION_BACKEND_URL}/api/notifications/register-token`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        userId,
        pushToken: token.data,
        deviceInfo: {
          platform: Platform.OS,
          deviceName: Device.deviceName,
          deviceType: Device.deviceType,
        },
      }),
    });

    return token.data;
  } catch (error) {
    console.error('Error registering for push notifications:', error);
    return null;
  }
}

/**
 * Update user notification preferences
 */
export async function updateNotificationPreferences(
  userId: string,
  preferences: {
    reminders?: boolean;
    updates?: boolean;
    changes?: boolean;
  }
) {
  try {
    const headers = await getAuthHeaders();
    await fetch(`${NOTIFICATION_BACKEND_URL}/api/notifications/preferences`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        userId,
        preferences,
      }),
    });
  } catch (error) {
    console.error('Error updating notification preferences:', error);
  }
}

/**
 * Get user notification preferences
 */
export async function getNotificationPreferences(userId: string) {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${NOTIFICATION_BACKEND_URL}/api/notifications/preferences/${userId}`,
      {
        headers,
      }
    );
    return await response.json();
  } catch (error) {
    console.error('Error fetching notification preferences:', error);
    return null;
  }
}

/**
 * Handle notification received while app is in foreground
 */
export function setupNotificationListeners() {
  // Handle notification received while app is foregrounded
  const foregroundSubscription = Notifications.addNotificationReceivedListener(
    notification => {
      console.log('Notification received in foreground:', notification);
      // You can show a custom in-app notification here
    }
  );

  // Handle user tapping on notification
  const responseSubscription = Notifications.addNotificationResponseReceivedListener(
    response => {
      console.log('Notification tapped:', response);
      const data = response.notification.request.content.data;
      
      // Handle deep linking based on notification data
      if (data?.deepLink) {
        // Navigate to the appropriate screen
        // You'll need to implement this based on your navigation setup
        handleDeepLink(data.deepLink);
      }
    }
  );

  return () => {
    foregroundSubscription.remove();
    responseSubscription.remove();
  };
}

/**
 * Handle deep links from notifications
 */
function handleDeepLink(deepLink: string) {
  // Implementation depends on your navigation setup
  // Example for expo-router:
  // router.push(deepLink);
  
  console.log('Should navigate to:', deepLink);
}

/**
 * Send webhook to notification backend when user performs actions
 */
export async function notifyBackendOfUserAction(action: {
  type: 'favorite_event' | 'unfavorite_event' | 'favorite_person' | 'unfavorite_person';
  userId: string;
  eventId?: string;
  personId?: string;
}) {
  try {
    const headers = await getAuthHeaders();
    await fetch(`${NOTIFICATION_BACKEND_URL}/api/webhooks/user-action`, {
      method: 'POST',
      headers,
      body: JSON.stringify(action),
    });
  } catch (error) {
    console.error('Error notifying backend of user action:', error);
  }
}

/**
 * Notify backend when an event is updated
 */
export async function notifyBackendOfEventUpdate(eventData: any) {
  try {
    const headers = await getAuthHeaders();
    await fetch(`${NOTIFICATION_BACKEND_URL}/api/webhooks/event-updated`, {
      method: 'POST',
      headers,
      body: JSON.stringify(eventData),
    });
  } catch (error) {
    console.error('Error notifying backend of event update:', error);
  }
}

/**
 * Notify backend when a new event is created
 */
export async function notifyBackendOfEventCreation(eventData: any) {
  try {
    const headers = await getAuthHeaders();
    await fetch(`${NOTIFICATION_BACKEND_URL}/api/webhooks/event-created`, {
      method: 'POST',
      headers,
      body: JSON.stringify(eventData),
    });
  } catch (error) {
    console.error('Error notifying backend of event creation:', error);
  }
}
