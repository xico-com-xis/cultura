import React, { useState, useEffect, useCallback } from 'react';
import { ScrollView, RefreshControl, Alert, TouchableOpacity, View, StyleSheet } from 'react-native';
import { Stack, useFocusEffect, router } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import ParticipantRequest from '@/components/ParticipantRequest';
import { ParticipantService, ParticipantRequest as ParticipantRequestType } from '@/services/participantService';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { IconSymbol } from '@/components/ui/IconSymbol';

export default function ParticipantRequestsScreen() {
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const [requests, setRequests] = useState<ParticipantRequestType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadRequests = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const pendingRequests = await ParticipantService.getPendingRequestsForUser(user.id);
      setRequests(pendingRequests);
    } catch (error) {
      console.error('Error loading participant requests:', error);
      Alert.alert('Error', 'Failed to load participant requests');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadRequests();
    setRefreshing(false);
  };

  const handleRequestHandled = () => {
    // Reload requests when one is handled
    loadRequests();
  };

  useFocusEffect(
    useCallback(() => {
      loadRequests();
    }, [user])
  );

  if (loading) {
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
            <ThemedText style={styles.headerTitle}>Tag Requests</ThemedText>
            <View style={{ width: 40 }} />
          </ThemedView>
          <ThemedView style={styles.loadingContainer}>
            <ThemedText style={styles.loadingText}>Loading requests...</ThemedText>
          </ThemedView>
        </ThemedView>
      </>
    );
  }

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
          <ThemedText style={styles.headerTitle}>Tag Requests</ThemedText>
          <View style={{ width: 40 }} />
        </ThemedView>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={Colors[colorScheme ?? 'light'].tint}
            />
          }
        >
          {requests.length === 0 ? (
            <View style={styles.emptyState}>
              <IconSymbol 
                name="person.badge.plus" 
                size={64} 
                color={Colors[colorScheme ?? 'light'].text} 
                style={styles.emptyIcon}
              />
              <ThemedText style={styles.emptyTitle}>No Tag Requests</ThemedText>
              <ThemedText style={styles.emptyMessage}>
                You don't have any pending tag requests from event organizers.
              </ThemedText>
            </View>
          ) : (
            <View style={styles.requestsList}>
              <ThemedText style={styles.sectionTitle}>
                Pending Tag Requests ({requests.length})
              </ThemedText>
              <ThemedText style={styles.sectionDescription}>
                Event organizers have tagged you in their events. Accept or decline to control your participation.
              </ThemedText>
              
              {requests.map((request) => (
                <ParticipantRequest
                  key={request.id}
                  eventId={request.eventId}
                  eventTitle={request.eventTitle}
                  organizerName={request.organizerName}
                  onRequestHandled={handleRequestHandled}
                />
              ))}
            </View>
          )}
        </ScrollView>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
  },
  loadingText: {
    textAlign: 'center',
    fontSize: 16,
    marginTop: 50,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIcon: {
    marginBottom: 16,
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.7,
    lineHeight: 22,
  },
  requestsList: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 24,
    lineHeight: 20,
  },
});