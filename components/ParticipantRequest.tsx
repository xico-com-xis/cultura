import React from 'react';
import { View, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

interface ParticipantRequestProps {
  eventId: string;
  eventTitle: string;
  organizerName: string;
  onRequestHandled: () => void;
}

export default function ParticipantRequest({ 
  eventId, 
  eventTitle, 
  organizerName, 
  onRequestHandled 
}: ParticipantRequestProps) {
  const colorScheme = useColorScheme();
  const { user } = useAuth();

  const handleAccept = async () => {
    if (!user) return;

    try {
      // Update the participant status to 'accepted'
      const { error } = await supabase
        .from('event_participants')
        .update({ status: 'accepted' })
        .match({ 
          event_id: eventId, 
          user_id: user.id,
          status: 'pending'
        });

      if (error) throw error;

      Alert.alert('Success', 'You have accepted the tag request!');
      onRequestHandled();
    } catch (error) {
      console.error('Error accepting request:', error);
      Alert.alert('Error', 'Failed to accept request. Please try again.');
    }
  };

  const handleDecline = async () => {
    if (!user) return;

    try {
      // Update the participant status to 'declined'
      const { error } = await supabase
        .from('event_participants')
        .update({ status: 'declined' })
        .match({ 
          event_id: eventId, 
          user_id: user.id,
          status: 'pending'
        });

      if (error) throw error;

      Alert.alert('Declined', 'You have declined the tag request.');
      onRequestHandled();
    } catch (error) {
      console.error('Error declining request:', error);
      Alert.alert('Error', 'Failed to decline request. Please try again.');
    }
  };

  return (
    <ThemedView style={[
      styles.container,
      { borderColor: Colors[colorScheme ?? 'light'].tint }
    ]}>
      <View style={styles.header}>
        <IconSymbol 
          name="person.badge.plus" 
          size={24} 
          color={Colors[colorScheme ?? 'light'].tint} 
        />
        <ThemedText style={styles.headerText}>Tag Request</ThemedText>
      </View>
      
      <ThemedText style={styles.message}>
        <ThemedText style={styles.organizerName}>{organizerName}</ThemedText>
        {' '}has tagged you in the event{' '}
        <ThemedText style={styles.eventTitle}>"{eventTitle}"</ThemedText>
      </ThemedText>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[
            styles.button,
            styles.acceptButton,
            { backgroundColor: Colors[colorScheme ?? 'light'].tint }
          ]}
          onPress={handleAccept}
        >
          <IconSymbol name="checkmark" size={16} color="#FFFFFF" />
          <ThemedText style={styles.acceptButtonText}>Accept</ThemedText>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.button,
            styles.declineButton,
            { borderColor: Colors[colorScheme ?? 'light'].text }
          ]}
          onPress={handleDecline}
        >
          <IconSymbol name="xmark" size={16} color={Colors[colorScheme ?? 'light'].text} />
          <ThemedText style={styles.declineButtonText}>Decline</ThemedText>
        </TouchableOpacity>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    margin: 16,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  organizerName: {
    fontWeight: '600',
  },
  eventTitle: {
    fontWeight: '600',
    fontStyle: 'italic',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  acceptButton: {
    backgroundColor: '#007AFF',
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  declineButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  declineButtonText: {
    fontWeight: '600',
    fontSize: 14,
  },
});