import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';

export default function ProfileScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.header}>
        <ThemedText type="title">Profile</ThemedText>
      </ThemedView>
      
      <ThemedView style={styles.profileInfo}>
        <ThemedText type="title">User Name</ThemedText>
        <ThemedText>user@example.com</ThemedText>
      </ThemedView>
      
      <ThemedView style={styles.section}>
        <ThemedText type="defaultSemiBold">My Events</ThemedText>
        <ThemedText>You haven't subscribed to any events yet.</ThemedText>
      </ThemedView>
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
  }
});