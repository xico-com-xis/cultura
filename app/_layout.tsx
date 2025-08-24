import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { AuthProvider } from '@/context/AuthContext';
import { EventProvider } from '@/context/EventsContext';
import { useColorScheme } from '@/hooks/useColorScheme';

// Configure how notifications behave when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  // Set up notification listeners
  useEffect(() => {
    // Handle notification responses (when user taps on notification)
    const notificationResponseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification response received:', response);
      
      // Here you can navigate to specific screens based on notification data
      // For example, if the notification contains an eventId, you could navigate to that event
      const eventId = response.notification.request.content.data?.eventId;
      if (eventId) {
        // Navigation would be handled here
        console.log('Navigate to event:', eventId);
      }
    });

    // Handle notifications received while app is in foreground
    const notificationReceivedListener = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received in foreground:', notification);
    });

    return () => {
      notificationResponseListener.remove();
      notificationReceivedListener.remove();
    };
  }, []);

  if (!loaded) {
    // Async font loading only occurs in development.
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <EventProvider>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="auth/login" options={{ headerShown: false }} />
            <Stack.Screen name="event/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="profile/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="notifications-favorites" options={{ headerShown: false }} />
            <Stack.Screen name="+not-found" />
          </Stack>
          <StatusBar style="auto" />
        </EventProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
