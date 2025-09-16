import { supabase } from '@/lib/supabase';
import * as Notifications from 'expo-notifications';

export interface ParticipantRequest {
  id: string;
  eventId: string;
  userId: string;
  eventTitle: string;
  organizerName: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
}

export class ParticipantService {
  
  /**
   * Get all pending participant requests for a user
   */
  static async getPendingRequestsForUser(userId: string): Promise<ParticipantRequest[]> {
    try {
      const { data: requests, error } = await supabase
        .from('event_participants')
        .select(`
          id,
          event_id,
          user_id,
          status,
          created_at,
          events!inner (
            id,
            title,
            created_by
          )
        `)
        .eq('user_id', userId)
        .eq('status', 'pending');

      if (error) throw error;

      if (!requests || requests.length === 0) {
        return [];
      }

      // Get organizer info for each event
      const organizerIds = [...new Set(requests.map(r => (r as any).events.created_by))];
      const { data: organizers, error: organizerError } = await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', organizerIds);

      if (organizerError) {
        console.error('Error fetching organizer info:', organizerError);
        return [];
      }

      return requests.map(request => ({
        id: request.id.toString(),
        eventId: request.event_id,
        userId: request.user_id,
        eventTitle: (request as any).events.title,
        organizerName: organizers?.find(o => o.id === (request as any).events.created_by)?.display_name || 'Unknown Organizer',
        status: request.status,
        createdAt: request.created_at,
      }));
    } catch (error) {
      console.error('Error fetching pending requests:', error);
      return [];
    }
  }

  /**
   * Accept a participant request
   */
  static async acceptRequest(eventId: string, userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('event_participants')
        .update({ status: 'accepted' })
        .match({ 
          event_id: eventId, 
          user_id: userId,
          status: 'pending'
        });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error accepting request:', error);
      return false;
    }
  }

  /**
   * Decline a participant request
   */
  static async declineRequest(eventId: string, userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('event_participants')
        .update({ status: 'declined' })
        .match({ 
          event_id: eventId, 
          user_id: userId,
          status: 'pending'
        });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error declining request:', error);
      return false;
    }
  }

  /**
   * Create participant requests for mentioned users
   */
  static async createParticipantRequests(
    eventId: string, 
    participants: Array<{
      id: string;
      name: string;
      status: 'pending' | 'accepted' | 'declined';
      isExternal?: boolean;
    }>
  ): Promise<boolean> {
    try {
      console.log('ParticipantService.createParticipantRequests called with:');
      console.log('- EventID:', eventId);
      console.log('- Participants:', participants);

      // Filter only pending participants (mentioned users)
      const pendingParticipants = participants
        .filter(p => p.status === 'pending' && !p.isExternal)
        .map(p => ({
          event_id: eventId,
          user_id: p.id,
          status: 'pending',
          is_external: false
        }));

      console.log('- Pending participants to insert:', pendingParticipants);

      // Filter accepted participants (manually selected)
      const acceptedParticipants = participants
        .filter(p => p.status === 'accepted')
        .map(p => ({
          event_id: eventId,
          user_id: p.isExternal ? null : p.id,
          status: 'accepted',
          is_external: p.isExternal || false,
          external_name: p.isExternal ? p.name : null,
          external_email: null // Could be added later if needed
        }));

      console.log('- Accepted participants to insert:', acceptedParticipants);

      const allParticipants = [...pendingParticipants, ...acceptedParticipants];
      console.log('- All participants for database:', allParticipants);

      if (allParticipants.length === 0) return true;

      const { error } = await supabase
        .from('event_participants')
        .insert(allParticipants);

      if (error) throw error;

      // Send notifications to mentioned users (pending requests only)
      await this.sendParticipantRequestNotifications(eventId, pendingParticipants.map(p => p.user_id));

      return true;
    } catch (error) {
      console.error('Error creating participant requests:', error);
      return false;
    }
  }

  /**
   * Send push notifications to mentioned users
   */
  static async sendParticipantRequestNotifications(eventId: string, userIds: string[]): Promise<void> {
    try {
      // Get event details and organizer info
      const { data: event, error: eventError } = await supabase
        .from('events')
        .select(`
          id,
          title,
          created_by
        `)
        .eq('id', eventId)
        .single();

      if (eventError || !event) {
        console.error('Error fetching event for notifications:', eventError);
        return;
      }

      // Get organizer info separately
      const { data: organizer, error: organizerError } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', event.created_by)
        .single();

      if (organizerError) {
        console.error('Error fetching organizer info:', organizerError);
        return;
      }

      // Get push tokens for mentioned users (handle missing column gracefully)
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id')
        .in('id', userIds);

      if (profilesError) {
        console.error('Error fetching profiles for notifications:', profilesError);
        return;
      }

      const organizerName = organizer?.display_name || 'Unknown Organizer';

      // For now, we'll skip push notifications since push_token column doesn't exist
      // TODO: Add push_token column to profiles table for notifications
      console.log(`Would send notifications to ${profiles?.length || 0} users about tag in "${event.title}" by ${organizerName}`);

      // Future implementation would send actual push notifications:
      // const notifications = (profiles || []).map(profile => ({...}));
    } catch (error) {
      console.error('Error sending participant request notifications:', error);
    }
  }

  /**
   * Get participant requests count for a user
   */
  static async getPendingRequestsCount(userId: string): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('event_participants')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'pending');

      if (error) throw error;
      return count || 0;
    } catch (error) {
      console.error('Error fetching pending requests count:', error);
      return 0;
    }
  }

  /**
   * Get all events where user is a participant (any status)
   */
  static async getEventsForUser(userId: string): Promise<Array<{
    eventId: string;
    status: 'pending' | 'accepted' | 'declined';
  }>> {
    try {
      const { data: participations, error } = await supabase
        .from('event_participants')
        .select('event_id, status')
        .eq('user_id', userId);

      if (error) throw error;

      return (participations || []).map(p => ({
        eventId: p.event_id,
        status: p.status as 'pending' | 'accepted' | 'declined'
      }));
    } catch (error) {
      console.error('Error fetching user participations:', error);
      return [];
    }
  }
}