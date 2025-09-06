import { supabase } from '@/lib/supabase';
import { preloadImages } from '@/utils/imageCache';
import * as Notifications from 'expo-notifications';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';

// Point-in-polygon algorithm (ray casting)
const isPointInPolygon = (point: { latitude: number; longitude: number }, polygon: Array<{ latitude: number; longitude: number }>): boolean => {
  if (polygon.length < 3) return false;
  
  const { latitude: x, longitude: y } = point;
  let inside = false;
  
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const { latitude: xi, longitude: yi } = polygon[i];
    const { latitude: xj, longitude: yj } = polygon[j];
    
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  
  return inside;
};

// Country-City mapping (in a real app, this would come from a database or API)
const COUNTRY_CITIES: Record<string, string[]> = {
  'Portugal': ['Lisboa', 'Porto', 'Braga', 'Coimbra', 'Faro', 'Aveiro', 'Évora', 'Viseu'],
  'Spain': ['Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Bilbao', 'Málaga', 'Zaragoza', 'Granada'],
  'France': ['Paris', 'Lyon', 'Marseille', 'Toulouse', 'Nice', 'Nantes', 'Strasbourg', 'Bordeaux'],
  'Italy': ['Roma', 'Milano', 'Napoli', 'Torino', 'Palermo', 'Genova', 'Bologna', 'Firenze'],
  'Germany': ['Berlin', 'Hamburg', 'München', 'Köln', 'Frankfurt', 'Stuttgart', 'Düsseldorf', 'Dortmund'],
  'United Kingdom': ['London', 'Manchester', 'Birmingham', 'Glasgow', 'Liverpool', 'Edinburgh', 'Bristol', 'Cardiff'],
  'Netherlands': ['Amsterdam', 'Rotterdam', 'Den Haag', 'Utrecht', 'Eindhoven', 'Tilburg', 'Groningen', 'Almere'],
  'Belgium': ['Brussels', 'Antwerp', 'Ghent', 'Charleroi', 'Liège', 'Bruges', 'Namur', 'Leuven'],
};

/*************/
/*** TYPES ***/
/*************/

// Define event types
export type EventType = 'music' | 'art' | 'theater' | 'dance' | 'workshop' | 'festival' | 'exhibition' | 'film' | 'literature' | 'other';

// Define event schedule (for events with multiple dates)
export type EventSchedule = {
  date: string; // ISO format: "2025-05-15T19:00:00"
  endDate?: string; // Optional end date/time
};

// Define the organizer type
export type Organizer = {
  id: string;
  name: string;
  profileImage?: string;
  contact?: {
    email?: string;
    phone?: string;
    website?: string;
  };
  allowContactSharing?: boolean;
  // External participant fields
  isExternal?: boolean;
  email?: string; // For external participants
};

// Define accessibility options
export type AccessibilityFeature = 'wheelchair' | 'hearing' | 'visual' | 'parking' | 'restroom' | 'seating';

// Define ticket information
export type TicketInfo = {
  type: 'free' | 'paid' | 'donation';
  price?: number; // If paid, the price
  currency?: string; // EUR, USD, etc.
  purchaseLink?: string; // URL to purchase tickets
  onSiteAvailable?: boolean; // If tickets are available at the venue
};

// Define participation type
export type ParticipationType = 'active' | 'audience';

// Define the event type
export type Event = {
  id: string;
  title: string;
  type: EventType;
  schedule: EventSchedule[];
  location: string;
  city: string; // Must match one of the cities in COUNTRY_CITIES
  country: string; // Must match one of the countries in COUNTRY_CITIES
  description: string;
  organizer: Organizer;
  professionals?: string[]; // Cultural professionals involved
  participants?: Organizer[]; // Tagged participants/users
  accessibility: AccessibilityFeature[];
  ticketInfo: TicketInfo;
  participationType?: ParticipationType; // Type of participation required (optional for backward compatibility)
  durationMinutes?: number | null; // Duration of the event in minutes (optional for backward compatibility, null for undefined duration)
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  images?: string[]; // Array of URLs to event images (max 5)
};

// Define filter state type
type FilterState = {
  selectedTypes: Array<EventType | 'all'>;
  selectedParticipationTypes: Array<ParticipationType | 'all'>;
  mapFilterEnabled: boolean;
  drawingMode: boolean;
  selectedCity: string | 'all';
  polygonCoords: Array<{ latitude: number; longitude: number }>;
  shouldNavigateToMap: boolean;
  selectedCountry: string;
  showFollowingOnly: boolean;
};

// Define notification types
export type NotificationType = 'reminders' | 'updates' | 'changes';

// Define favorite state types
type FavoriteState = {
  favoriteEvents: Set<string>;
  favoritePeople: Set<string>;
  globalNotificationSettings: Set<NotificationType>;
};

// Create context
type EventsContextType = {
  events: Event[];
  setEvents: React.Dispatch<React.SetStateAction<Event[]>>;
  addEvent: (event: Omit<Event, 'id'>) => Promise<Event>;
  updateEvent: (eventId: string, eventData: Event) => Promise<void>;
  deleteEvent: (eventId: string) => Promise<void>;
  filters: FilterState;
  setSelectedTypes: (types: Array<EventType | 'all'>) => void;
  setSelectedParticipationTypes: (types: Array<ParticipationType | 'all'>) => void;
  setMapFilterEnabled: (enabled: boolean) => void;
  setDrawingMode: (enabled: boolean) => void;
  setSelectedCity: (city: string) => void;
  setPolygonCoords: (coords: Array<{ latitude: number; longitude: number }>) => void;
  setShouldNavigateToMap: (should: boolean) => void;
  setSelectedCountry: (country: string) => void;
  setShowFollowingOnly: (enabled: boolean) => void;
  filteredEvents: Event[];
  availableCities: string[];
  availableCountries: string[];
  loading: boolean;
  refreshEvents: () => Promise<void>;
  // Favorite/notification functions
  favoriteState: FavoriteState;
  favoriteEvent: (eventId: string) => Promise<void>;
  unfavoriteEvent: (eventId: string) => Promise<void>;
  isEventFavorited: (eventId: string) => boolean;
  favoritePerson: (personId: string) => Promise<void>;
  unfavoritePerson: (personId: string) => Promise<void>;
  isPersonFavorited: (personId: string) => boolean;
  updateGlobalNotificationSetting: (notificationType: NotificationType, enabled: boolean) => Promise<void>;
  isGlobalNotificationEnabled: (notificationType: NotificationType) => boolean;
};




const EventsContext = createContext<EventsContextType | undefined>(undefined);

export const EventProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const { user } = useAuth();

    // Load events on component mount
  useEffect(() => {
    let isInitialized = false;
    
    const testConnection = async () => {
      if (isInitialized) return;
      isInitialized = true;
      
      try {
        const { data, error } = await supabase
          .from('events')
          .select('count')
          .limit(1);
        
        if (error) {
          console.error('Supabase connection test failed:', error);
        }
      } catch (err) {
        console.error('Supabase connection test exception:', err);
      }
      
      fetchEvents();
    };
    
    testConnection();
  }, []);

  // Preload images when events are loaded or updated
  useEffect(() => {
    if (events.length > 0) {
      const imageUrls = events
        .flatMap(event => event.images || [])
        .filter((url): url is string => Boolean(url));
      
      if (imageUrls.length > 0) {
        // Preload images in background without blocking UI
        preloadImages(imageUrls).catch(error => {
          console.warn('Image preloading failed:', error);
        });
      }
    }
  }, [events]);

    // Load favorite/notification data on user login
  useEffect(() => {
    if (user) {
      loadFavoriteEvents();
      loadFavoritePeople();
      loadGlobalNotificationSettings();
    } else {
      // Clear data on logout
      setFavoriteState({
        favoriteEvents: new Set<string>(),
        favoritePeople: new Set<string>(),
        globalNotificationSettings: new Set<NotificationType>(),
      });
    }
  }, [user]);
  
  // Add filter state
  const [filters, setFilters] = useState<FilterState>({
    selectedTypes: ['all'],
    selectedParticipationTypes: ['all'],
    mapFilterEnabled: false,
    drawingMode: false,
    selectedCity: 'all',
    polygonCoords: [],
    shouldNavigateToMap: false,
    selectedCountry: 'Portugal', // Default country
    showFollowingOnly: false,
  });

  // Favorite/notification state
  const [favoriteState, setFavoriteState] = useState<FavoriteState>({
    favoriteEvents: new Set<string>(),
    favoritePeople: new Set<string>(),
    globalNotificationSettings: new Set<NotificationType>(),
  });




  // Function to fetch multiple user display names by user IDs (batch operation)
  const fetchUserDisplayNames = async (userIds: string[]): Promise<Record<string, string>> => {
    try {
      const uniqueUserIds = [...new Set(userIds)]; // Remove duplicates
      const userNameMap: Record<string, string> = {};
      
      // For now, let's try to get basic info and fall back to a meaningful default
      // In a real implementation, you would query your user profiles table
      
      // Try to get from profiles table first (common Supabase pattern)
      try {
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, display_name, full_name')
          .in('id', uniqueUserIds);
          
        if (!profilesError && profilesData && profilesData.length > 0) {
          profilesData.forEach(profile => {
            userNameMap[profile.id] = profile.display_name || profile.full_name || 'Event Organizer';
          });
        }
      } catch (error) {
        console.log('Profiles table not available:', error);
      }
      
      // Fill in any missing users with fallback
      uniqueUserIds.forEach(userId => {
        if (!userNameMap[userId]) {
          // Create a meaningful fallback based on user ID
          const shortId = userId.substring(0, 8);
          userNameMap[userId] = `User ${shortId}`;
        }
      });
      
      return userNameMap;
             
    } catch (error) {
      console.log('Error fetching user display names:', error);
      const fallbackMap: Record<string, string> = {};
      userIds.forEach(userId => {
        const shortId = userId.substring(0, 8);
        fallbackMap[userId] = `User ${shortId}`;
      });
      return fallbackMap;
    }
  };

  // Function to fetch user display name by user ID
  const fetchUserDisplayName = async (userId: string): Promise<string> => {
    const userNameMap = await fetchUserDisplayNames([userId]);
    return userNameMap[userId] || 'Event Organizer';
  };

  // Transform database response to Event type (synchronous version with organizer name)
  const transformEventDataSync = (dbEvent: any, organizerName: string): Event => {
    // Transform schedules - handle both RPC (JSONB) and manual query (joined arrays) formats
    let schedules: EventSchedule[] = [];
    
    // Check if this is RPC data (JSONB fields) or manual query data (joined arrays)
    if (dbEvent.schedules && Array.isArray(dbEvent.schedules)) {
      // RPC format - schedules is a JSONB array
      schedules = dbEvent.schedules.map((schedule: any) => ({
        date: schedule.date,
        endDate: schedule.endDate || undefined
      }));
    } else if (dbEvent.event_schedules && Array.isArray(dbEvent.event_schedules)) {
      // Manual query format - event_schedules is a joined table
      schedules = dbEvent.event_schedules.map((schedule: any) => ({
        date: schedule.start_date,
        endDate: schedule.end_date || undefined
      }));
    }

    // Transform tickets - handle both formats
    let ticketInfo: TicketInfo = { type: 'free' };
    if (dbEvent.tickets && typeof dbEvent.tickets === 'object') {
      // RPC format - tickets is a JSONB object
      ticketInfo = {
        type: dbEvent.tickets.type as 'free' | 'paid' | 'donation',
        price: dbEvent.tickets.price || undefined,
        currency: dbEvent.tickets.currency || undefined,
        purchaseLink: dbEvent.tickets.purchaseLink || undefined,
        onSiteAvailable: dbEvent.tickets.onSiteAvailable || false
      };
    } else if (dbEvent.event_tickets && Array.isArray(dbEvent.event_tickets) && dbEvent.event_tickets.length > 0) {
      // Manual query format - event_tickets is a joined table
      const ticket = dbEvent.event_tickets[0]; // Take the first ticket info
      ticketInfo = {
        type: ticket.type as 'free' | 'paid' | 'donation',
        price: ticket.price || undefined,
        currency: ticket.currency || undefined,
        purchaseLink: ticket.purchase_link || undefined,
        onSiteAvailable: ticket.on_site_available || false
      };
    }

    // Transform accessibility features - handle both formats
    let accessibility: AccessibilityFeature[] = [];
    if (dbEvent.accessibility && Array.isArray(dbEvent.accessibility)) {
      // RPC format - accessibility is a JSONB array
      accessibility = dbEvent.accessibility as AccessibilityFeature[];
    } else if (dbEvent.event_accessibility && Array.isArray(dbEvent.event_accessibility)) {
      // Manual query format - event_accessibility is a joined table
      accessibility = dbEvent.event_accessibility.map((acc: any) => acc.feature as AccessibilityFeature);
    }

    // Transform participants - handle both formats
    let participants: any[] = [];
    if (dbEvent.participants && Array.isArray(dbEvent.participants)) {
      // RPC format - participants is a JSONB array
      participants = dbEvent.participants;
    } else {
      // If participants not included in RPC, we'll fetch them separately
      // This will be handled in the loadEvents function
      participants = [];
    }

    return {
      id: dbEvent.id,
      title: dbEvent.title,
      type: dbEvent.type as EventType,
      schedule: schedules,
      location: dbEvent.location,
      city: dbEvent.city,
      country: dbEvent.country,
      description: dbEvent.description || '',
      organizer: dbEvent.organizer || {
        id: dbEvent.created_by || 'unknown',
        name: organizerName,
        profileImage: undefined
      },
      professionals: [], // We don't store this in the basic schema
      accessibility: accessibility,
      ticketInfo: ticketInfo,
      participants: participants,
      participationType: dbEvent.participation_type as ParticipationType || 'audience', // Default to audience
      durationMinutes: dbEvent.duration_minutes || 60, // Default to 1 hour
      coordinates: dbEvent.coordinates_lat && dbEvent.coordinates_lng ? {
        latitude: parseFloat(dbEvent.coordinates_lat),
        longitude: parseFloat(dbEvent.coordinates_lng)
      } : undefined,
      images: (() => {
        // Handle multiple image formats:
        // 1. New format: images array in dedicated column
        // 2. Legacy format: single image URL in image_url
        // 3. Multi-image format: JSON array stored in image_url field
        
        if (dbEvent.images && Array.isArray(dbEvent.images) && dbEvent.images.length > 0) {
          return dbEvent.images;
        } else if (dbEvent.images && !Array.isArray(dbEvent.images)) {
          return [dbEvent.images];
        } else if (dbEvent.image_url) {
          // Check if image_url contains a JSON array (starts with '[')
          if (typeof dbEvent.image_url === 'string' && dbEvent.image_url.startsWith('[')) {
            try {
              const parsedImages = JSON.parse(dbEvent.image_url);
              return Array.isArray(parsedImages) ? parsedImages : [dbEvent.image_url];
            } catch (error) {
              // If parsing fails, treat as single URL
              return [dbEvent.image_url];
            }
          } else {
            // Single image URL
            return [dbEvent.image_url];
          }
        } else {
          return undefined;
        }
      })()
    };
  };

  // Transform database response to Event type (async version)
  const transformEventData = async (dbEvent: any): Promise<Event> => {
    // Fetch organizer display name
    const organizerName = await fetchUserDisplayName(dbEvent.created_by || 'unknown');
    return transformEventDataSync(dbEvent, organizerName);
  };

  // Smart merge function to combine local and database events
  const mergeEventsSmartly = (currentEvents: Event[], databaseEvents: Event[]): Event[] => {
    // Start with database events as the source of truth
    const mergedEvents = [...databaseEvents];
    
    // Add any local events that aren't in the database yet
    currentEvents.forEach(localEvent => {
      const existsInDatabase = databaseEvents.some(dbEvent => dbEvent.id === localEvent.id);
      if (!existsInDatabase) {
        mergedEvents.push(localEvent);
      }
    });
    
    return mergedEvents;
  };

  // Fetch participants for events from event_participants table
  const fetchEventParticipants = async (eventIds: string[]) => {
    if (eventIds.length === 0) return {};
    
    try {
      const { data: participantsData, error } = await supabase
        .from('event_participants')
        .select(`
          id,
          event_id,
          user_id,
          is_external,
          external_name,
          external_email,
          profiles:user_id (
            id,
            display_name,
            full_name,
            avatar_url
          )
        `)
        .in('event_id', eventIds);

      if (error) {
        console.error('Error fetching participants:', error);
        return {};
      }

      // Group participants by event_id
      const participantsByEvent: { [eventId: string]: any[] } = {};
      
      participantsData?.forEach((participant: any) => {
        if (!participantsByEvent[participant.event_id]) {
          participantsByEvent[participant.event_id] = [];
        }
        
        if (participant.is_external) {
          // External participant - use the event_participants table ID for uniqueness
          participantsByEvent[participant.event_id].push({
            id: `external_participant_${participant.id}`, // Use event_participants table ID
            name: participant.external_name,
            email: participant.external_email,
            isExternal: true,
            profileImage: undefined,
          });
        } else if (participant.profiles) {
          // App user participant
          participantsByEvent[participant.event_id].push({
            id: participant.profiles.id,
            name: participant.profiles.display_name || participant.profiles.full_name || 'Unknown User',
            email: undefined,
            isExternal: false,
            profileImage: participant.profiles.avatar_url,
          });
        }
      });

      return participantsByEvent;
    } catch (error) {
      console.error('Error in fetchEventParticipants:', error);
      return {};
    }
  };

  // Fetch events from Supabase
  const fetchEvents = async () => {
    try {
      setLoading(true);
      
      // Try RPC function first
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_events_with_details');
        
        if (!rpcError && rpcData && rpcData.length >= 0) {
          console.log('RPC startup successful, got', rpcData.length, 'events');
          
          // Extract all unique user IDs for batch fetching
          const userIds = [...new Set(rpcData.map((event: any) => event.created_by).filter(Boolean))] as string[];
          const userNameMap = await fetchUserDisplayNames(userIds);
          
          // Fetch participants for all events
          const eventIds = rpcData.map((event: any) => event.id);
          const participantsByEvent = await fetchEventParticipants(eventIds);
          console.log('Debug - fetched participants by event:', participantsByEvent);
          
          // Transform events with the user name map and participants
          const transformedEvents: Event[] = rpcData.map((dbEvent: any) => {
            const organizerName = userNameMap[dbEvent.created_by] || 'Event Organizer';
            // Add participants to dbEvent before transformation
            dbEvent.participants = participantsByEvent[dbEvent.id] || [];
            console.log(`Debug - Event ${dbEvent.id} participants:`, dbEvent.participants);
            return transformEventDataSync(dbEvent, organizerName);
          }).filter(Boolean);
          
          setEvents(currentEvents => mergeEventsSmartly(currentEvents, transformedEvents));
          console.log('Startup load completed successfully');
          return;
        }
      } catch (rpcError) {
        console.log('RPC startup failed, trying manual query:', rpcError);
      }

      console.log('Using fallback manual query...');
      
      // Fallback to manual query with proper joins
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select(`
          *,
          event_schedules(*),
          event_tickets(*),
          event_accessibility(*)
        `);
      
      console.log('Manual query result:', { eventsData, eventsError });
      
      if (eventsError) {
        console.error('Manual query failed:', eventsError);
        return;
      }

      if (eventsData) {
        console.log('Sample raw event data:', eventsData[0]);
        
        // Extract all unique user IDs for batch fetching
        const userIds = [...new Set(eventsData.map(event => event.created_by).filter(Boolean))];
        const userNameMap = await fetchUserDisplayNames(userIds);
        
        // Transform events with the user name map
        const transformedEvents = eventsData.map(dbEvent => {
          const organizerName = userNameMap[dbEvent.created_by] || 'Event Organizer';
          return transformEventDataSync(dbEvent, organizerName);
        });
        
        console.log('Sample transformed event:', transformedEvents[0]);
        setEvents(currentEvents => mergeEventsSmartly(currentEvents, transformedEvents));
      }
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  // Refresh events (for manual refresh)
  const refreshEvents = async () => {
    try {
      console.log('Manual refresh started...');
      setLoading(true);
      
      // Try RPC function first
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_events_with_details');
        
        if (!rpcError && rpcData && rpcData.length >= 0) {
          console.log('RPC refresh successful, got', rpcData.length, 'events');
          
          // Extract all unique user IDs for batch fetching
          const userIds = [...new Set(rpcData.map((event: any) => event.created_by).filter(Boolean))] as string[];
          const userNameMap = await fetchUserDisplayNames(userIds);
          
          // Fetch participants for all events
          const eventIds = rpcData.map((event: any) => event.id);
          const participantsByEvent = await fetchEventParticipants(eventIds);
          console.log('Debug - refresh fetched participants by event:', participantsByEvent);
          
          // Transform events with the user name map and participants
          const transformedEvents: Event[] = rpcData.map((dbEvent: any) => {
            const organizerName = userNameMap[dbEvent.created_by] || 'Event Organizer';
            // Add participants to dbEvent before transformation
            dbEvent.participants = participantsByEvent[dbEvent.id] || [];
            console.log(`Debug - refresh Event ${dbEvent.id} participants:`, dbEvent.participants);
            return transformEventDataSync(dbEvent, organizerName);
          }).filter(Boolean);
          
          setEvents(currentEvents => mergeEventsSmartly(currentEvents, transformedEvents));
          console.log('Manual refresh completed successfully');
          return;
        }
      } catch (rpcError) {
        console.log('RPC refresh failed, trying manual query:', rpcError);
      }
      
      // Fallback to manual query
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select(`
          *,
          event_schedules(*),
          event_tickets(*),
          event_accessibility(*)
        `);
      
      if (eventsError) {
        console.error('Manual query refresh failed:', eventsError);
        throw eventsError;
      }

      if (eventsData) {
        console.log('Manual query refresh successful, got', eventsData.length, 'events');
        
        // Extract all unique user IDs for batch fetching
        const userIds = [...new Set(eventsData.map(event => event.created_by).filter(Boolean))];
        const userNameMap = await fetchUserDisplayNames(userIds);
        
        // Fetch participants for all events
        const eventIds = eventsData.map((event: any) => event.id);
        const participantsByEvent = await fetchEventParticipants(eventIds);
        console.log('Debug - manual refresh fetched participants by event:', participantsByEvent);
        
        // Transform events with the user name map and participants
        const transformedEvents = eventsData.map(dbEvent => {
          const organizerName = userNameMap[dbEvent.created_by] || 'Event Organizer';
          // Add participants to dbEvent before transformation
          dbEvent.participants = participantsByEvent[dbEvent.id] || [];
          console.log(`Debug - manual refresh Event ${dbEvent.id} participants:`, dbEvent.participants);
          return transformEventDataSync(dbEvent, organizerName);
        });
        
        setEvents(currentEvents => mergeEventsSmartly(currentEvents, transformedEvents));
        console.log('Manual refresh completed successfully');
      } else {
        console.log('No events data received, keeping current events');
      }
    } catch (error) {
      console.error('Error during manual refresh:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Filter update methods
  const setSelectedTypes = (types: Array<EventType | 'all'>) => {
    setFilters(prev => ({ ...prev, selectedTypes: types }));
  };

  const setSelectedParticipationTypes = (types: Array<ParticipationType | 'all'>) => {
    setFilters(prev => ({ ...prev, selectedParticipationTypes: types }));
  };

  const setMapFilterEnabled = (enabled: boolean) => {
    setFilters(prev => ({ ...prev, mapFilterEnabled: enabled }));
  };

  const setDrawingMode = (enabled: boolean) => {
    setFilters(prev => ({ ...prev, drawingMode: enabled }));
  };

  const setSelectedCity = (city: string) => {
    setFilters(prev => ({ ...prev, selectedCity: city }));
  };

  const setPolygonCoords = (coords: Array<{ latitude: number; longitude: number }>) => {
    setFilters(prev => ({ ...prev, polygonCoords: coords }));
  };

  const setShouldNavigateToMap = (should: boolean) => {
    setFilters(prev => ({ ...prev, shouldNavigateToMap: should }));
  };

  const setSelectedCountry = (country: string) => {
    setFilters(prev => ({ ...prev, selectedCountry: country, selectedCity: 'all' })); // Reset city when country changes
  };

  const setShowFollowingOnly = (enabled: boolean) => {
    setFilters(prev => ({ ...prev, showFollowingOnly: enabled }));
  };

  const loadFavoriteEvents = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('favorite_events')
        .select('event_id')
        .eq('user_id', user.id);

      if (error) {
        console.error('Error loading favorite events:', error);
        return;
      }

      const favoriteSet = new Set(data?.map(item => item.event_id) || []);
      setFavoriteState(prev => ({
        ...prev,
        favoriteEvents: favoriteSet,
      }));
    } catch (error) {
      console.error('Error loading favorite events:', error);
    }
  };

  const loadFavoritePeople = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('favorite_people')
        .select('person_id')
        .eq('user_id', user.id);

      if (error) {
        console.error('Error loading favorite people:', error);
        return;
      }

      const favoriteSet = new Set(data?.map(item => item.person_id) || []);
      setFavoriteState(prev => ({
        ...prev,
        favoritePeople: favoriteSet,
      }));
    } catch (error) {
      console.error('Error loading favorite people:', error);
    }
  };

  const loadGlobalNotificationSettings = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('global_notification_settings')
        .select('notification_type')
        .eq('user_id', user.id)
        .eq('enabled', true);

      if (error) {
        console.error('Error loading global notification settings:', error);
        return;
      }

      const settingsSet = new Set(data?.map(item => item.notification_type as NotificationType) || []);
      setFavoriteState(prev => ({
        ...prev,
        globalNotificationSettings: settingsSet,
      }));
    } catch (error) {
      console.error('Error loading global notification settings:', error);
    }
  };

  // Notification scheduling functions
  const scheduleEventNotifications = async (eventId: string) => {
    if (!user) return;

    const event = events.find(e => e.id === eventId);
    if (!event || !event.schedule || event.schedule.length === 0) return;

    try {
      // Check notification permissions first
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') return;

      // Schedule reminder notifications (30 minutes before event)
      if (isGlobalNotificationEnabled('reminders')) {
        for (const schedule of event.schedule) {
          if (!schedule || !schedule.date) continue; // Skip invalid schedule entries
          const eventDate = new Date(schedule.date);
          const reminderDate = new Date(eventDate.getTime() - 30 * 60 * 1000); // 30 minutes before
          const now = new Date();
          
          console.log(`Event "${event.title}":`);
          console.log(`  Event date: ${eventDate.toISOString()}`);
          console.log(`  Reminder date: ${reminderDate.toISOString()}`);
          console.log(`  Current time: ${now.toISOString()}`);
          console.log(`  Is reminder in future: ${reminderDate > now}`);
          
          // Only schedule if the reminder time is in the future
          if (reminderDate > now) {
            const secondsUntilReminder = Math.floor((reminderDate.getTime() - now.getTime()) / 1000);
            
            // Double check that we have a positive number of seconds
            if (secondsUntilReminder > 0) {
              console.log(`Attempting to schedule reminder for "${event.title}" in ${Math.floor(secondsUntilReminder / 3600)} hours and ${Math.floor((secondsUntilReminder % 3600) / 60)} minutes (${secondsUntilReminder} seconds)`);
              console.log(`Reminder date: ${reminderDate.toISOString()}`);
              console.log(`Days until reminder: ${Math.floor(secondsUntilReminder / (24 * 3600))}`);
              
              // Check if the date is too far in the future (iOS has limits)
              const maxFutureDays = 64; // iOS notification limit is typically 64 days
              if (secondsUntilReminder > maxFutureDays * 24 * 3600) {
                console.log(`Event is too far in the future (${Math.floor(secondsUntilReminder / (24 * 3600))} days). iOS limit is typically 64 days.`);
                console.log('Skipping notification - event is beyond iOS scheduling limit');
                return;
              }
              
              try {
                // Try to use the proper trigger format - schedule for specific time
                const result = await Notifications.scheduleNotificationAsync({
                  identifier: `reminder-${eventId}-${schedule.date}`,
                  content: {
                    title: '📅 Event Reminder',
                    body: `${event.title} starts in 30 minutes at ${event.location}`,
                    data: { 
                      eventId: event.id,
                      type: 'reminder',
                      eventTitle: event.title,
                      eventLocation: event.location
                    },
                  },
                  trigger: { 
                    type: 'date', 
                    date: reminderDate 
                  } as any, // Cast to bypass TypeScript definition issues
                });
                
                console.log('Notification scheduled successfully with ID:', result);
              } catch (triggerError) {
                console.error('Error scheduling notification with date trigger:', triggerError);
                
                // Fallback: don't schedule the notification rather than risk immediate delivery
                console.log('Skipping notification to avoid immediate delivery');
              }
            } else {
              console.log(`Skipping reminder for "${event.title}" - reminder time has passed (${secondsUntilReminder} seconds)`);
            }
          } else {
            console.log(`Skipping reminder for "${event.title}" - event is too soon or has passed`);
          }
        }
      }

      console.log('Scheduled notifications for event:', event.title);
      // Log all scheduled notifications for debugging
      await logScheduledNotifications();
    } catch (error) {
      console.error('Error scheduling event notifications:', error);
    }
  };

  const cancelEventNotifications = async (eventId: string) => {
    try {
      // Get all scheduled notifications
      const notifications = await Notifications.getAllScheduledNotificationsAsync();
      
      // Cancel notifications related to this event
      const eventNotifications = notifications.filter(notification => 
        notification.content.data?.eventId === eventId
      );

      for (const notification of eventNotifications) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }

      console.log('Cancelled notifications for event:', eventId);
    } catch (error) {
      console.error('Error cancelling event notifications:', error);
    }
  };

  const rescheduleAllEventNotifications = async () => {
    if (!user) return;

    try {
      // Cancel all existing event notifications
      const notifications = await Notifications.getAllScheduledNotificationsAsync();
      const eventNotifications = notifications.filter(notification => 
        notification.content.data?.type === 'reminder'
      );

      for (const notification of eventNotifications) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }

      // Reschedule for all favorited events
      const favoriteEventIds = Array.from(favoriteState.favoriteEvents);
      for (const eventId of favoriteEventIds) {
        await scheduleEventNotifications(eventId);
      }

      console.log('Rescheduled all event notifications');
    } catch (error) {
      console.error('Error rescheduling notifications:', error);
    }
  };

  // Debug function to log all scheduled notifications
  const logScheduledNotifications = async () => {
    try {
      const notifications = await Notifications.getAllScheduledNotificationsAsync();
      console.log('=== SCHEDULED NOTIFICATIONS ===');
      console.log(`Total scheduled: ${notifications.length}`);
      
      notifications.forEach((notification, index) => {
        const eventId = notification.content.data?.eventId;
        const eventTitle = notification.content.data?.eventTitle;
        const trigger = notification.trigger;
        
        if (trigger && 'seconds' in trigger && trigger.seconds) {
          const hoursUntil = Math.floor(trigger.seconds / 3600);
          const minutesUntil = Math.floor((trigger.seconds % 3600) / 60);
          console.log(`${index + 1}. "${eventTitle}" (ID: ${eventId}) - in ${hoursUntil}h ${minutesUntil}m`);
        }
      });
      console.log('==============================');
    } catch (error) {
      console.error('Error logging scheduled notifications:', error);
    }
  };

  // Event favorite functions
  const favoriteEvent = async (eventId: string) => {
    if (!user) {
      throw new Error('Must be logged in to favorite events');
    }

    try {
      const { error } = await supabase
        .from('favorite_events')
        .insert({ user_id: user.id, event_id: eventId });

      if (error) {
        console.error('Error favoriting event:', error);
        throw error;
      }

      setFavoriteState(prev => ({
        ...prev,
        favoriteEvents: new Set([...prev.favoriteEvents, eventId]),
      }));

      // Schedule notifications for this event if user has notification settings enabled
      await scheduleEventNotifications(eventId);
    } catch (error) {
      console.error('Error favoriting event:', error);
      throw error;
    }
  };

  const unfavoriteEvent = async (eventId: string) => {
    if (!user) {
      throw new Error('Must be logged in to unfavorite events');
    }

    try {
      const { error } = await supabase
        .from('favorite_events')
        .delete()
        .eq('user_id', user.id)
        .eq('event_id', eventId);

      if (error) {
        console.error('Error unfavoriting event:', error);
        throw error;
      }

      const newFavorites = new Set(favoriteState.favoriteEvents);
      newFavorites.delete(eventId);
      setFavoriteState(prev => ({
        ...prev,
        favoriteEvents: newFavorites,
      }));

      // Cancel notifications for this event
      await cancelEventNotifications(eventId);
    } catch (error) {
      console.error('Error unfavoriting event:', error);
      throw error;
    }
  };

  const isEventFavorited = (eventId: string): boolean => {
    return favoriteState.favoriteEvents.has(eventId);
  };

  // People favorite functions
  const favoritePerson = async (personId: string) => {
    if (!user) {
      throw new Error('Must be logged in to favorite people');
    }

    try {
      const { error } = await supabase
        .from('favorite_people')
        .insert({ user_id: user.id, person_id: personId });

      if (error) {
        console.error('Error favoriting person:', error);
        throw error;
      }

      setFavoriteState(prev => ({
        ...prev,
        favoritePeople: new Set([...prev.favoritePeople, personId]),
      }));
    } catch (error) {
      console.error('Error favoriting person:', error);
      throw error;
    }
  };

  const unfavoritePerson = async (personId: string) => {
    if (!user) {
      throw new Error('Must be logged in to unfavorite people');
    }

    try {
      const { error } = await supabase
        .from('favorite_people')
        .delete()
        .eq('user_id', user.id)
        .eq('person_id', personId);

      if (error) {
        console.error('Error unfavoriting person:', error);
        throw error;
      }

      const newFavorites = new Set(favoriteState.favoritePeople);
      newFavorites.delete(personId);
      setFavoriteState(prev => ({
        ...prev,
        favoritePeople: newFavorites,
      }));
    } catch (error) {
      console.error('Error unfavoriting person:', error);
      throw error;
    }
  };

  const isPersonFavorited = (personId: string): boolean => {
    return favoriteState.favoritePeople.has(personId);
  };

  // Global notification settings functions
  const updateGlobalNotificationSetting = async (notificationType: NotificationType, enabled: boolean) => {
    if (!user) {
      throw new Error('Must be logged in to manage notification settings');
    }

    try {
      if (enabled) {
        // Enable notification
        const { error } = await supabase
          .from('global_notification_settings')
          .upsert({
            user_id: user.id,
            notification_type: notificationType,
            enabled: true,
            updated_at: new Date().toISOString(),
          });

        if (error) {
          console.error('Error enabling global notification:', error);
          throw error;
        }

        setFavoriteState(prev => ({
          ...prev,
          globalNotificationSettings: new Set([...prev.globalNotificationSettings, notificationType]),
        }));

        // Reschedule notifications for all favorited events
        if (notificationType === 'reminders') {
          await rescheduleAllEventNotifications();
        }
      } else {
        // Disable notification
        const { error } = await supabase
          .from('global_notification_settings')
          .delete()
          .eq('user_id', user.id)
          .eq('notification_type', notificationType);

        if (error) {
          console.error('Error disabling global notification:', error);
          throw error;
        }

        const newSettings = new Set(favoriteState.globalNotificationSettings);
        newSettings.delete(notificationType);
        setFavoriteState(prev => ({
          ...prev,
          globalNotificationSettings: newSettings,
        }));

        // Cancel reminder notifications if reminders are disabled
        if (notificationType === 'reminders') {
          await rescheduleAllEventNotifications();
        }
      }
    } catch (error) {
      console.error('Error updating global notification setting:', error);
      throw error;
    }
  };

  const isGlobalNotificationEnabled = (notificationType: NotificationType): boolean => {
    return favoriteState.globalNotificationSettings.has(notificationType);
  };

  // Add a new event to Supabase and update local state
  const addEvent = async (eventData: Omit<Event, 'id'>) => {
    if (!user) {
      throw new Error('User must be logged in to create events');
    }

    try {
      const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !currentUser) {
        console.error('User authentication issue:', userError);
        throw new Error('Authentication failed. Please sign in again.');
      }

      const eventPayload = {
        title: eventData.title,
        type: eventData.type,
        description: eventData.description || 'No description provided',
        location: eventData.location,
        city: eventData.city,
        country: eventData.country,
        coordinates_lat: eventData.coordinates?.latitude || null,
        coordinates_lng: eventData.coordinates?.longitude || null,
        image_url: (() => {
          if (eventData.images && eventData.images.length > 0) {
            if (eventData.images.length === 1) {
              return eventData.images[0];
            } else {
              const jsonString = JSON.stringify(eventData.images);
              return jsonString;
            }
          }
          return null;
        })(),
        participation_type: eventData.participationType || 'audience',
        duration_minutes: eventData.durationMinutes || 60,
        created_by: currentUser.id,
      };

      const { data: eventRecord, error: eventError } = await supabase
        .from('events')
        .insert(eventPayload)
        .select()
        .single();

      if (eventError) {
        console.error('Failed to create event:', eventError);
        throw new Error(`Failed to create event: ${eventError.message || 'Unknown database error'}`);
      }

      // Insert schedules
      if (eventData.schedule && eventData.schedule.length > 0) {
        const schedulePromises = eventData.schedule.map(async (schedule) => {
          const { error } = await supabase
            .from('event_schedules')
            .insert({
              event_id: eventRecord.id,
              start_date: schedule.date,
              end_date: schedule.endDate || null,
            });
          if (error) {
            console.error('Schedule insertion error:', error);
          }
          return error;
        });
        
        const scheduleResults = await Promise.all(schedulePromises);
        const scheduleErrors = scheduleResults.filter(Boolean);
        if (scheduleErrors.length > 0) {
          console.warn('Some schedule insertions failed:', scheduleErrors);
        }
      }

      // Insert ticket information
      if (eventData.ticketInfo) {
        const { error: ticketError } = await supabase
          .from('event_tickets')
          .insert({
            event_id: eventRecord.id,
            type: eventData.ticketInfo.type,
            price: eventData.ticketInfo.price || null,
            currency: eventData.ticketInfo.currency || null,
            purchase_link: eventData.ticketInfo.purchaseLink || null,
            on_site_available: eventData.ticketInfo.onSiteAvailable || false,
          });
        
        if (ticketError) {
          console.error('Ticket insertion error:', ticketError);
        }
      }

      // Insert accessibility features
      if (eventData.accessibility && eventData.accessibility.length > 0) {
        const accessibilityPromises = eventData.accessibility.map(async (featureType) => {
          const { error } = await supabase
            .from('event_accessibility')
            .insert({
              event_id: eventRecord.id,
              feature: featureType,
            });
          if (error) {
            console.error('Accessibility insertion error:', error);
          }
          return error;
        });
        
        const accessibilityResults = await Promise.all(accessibilityPromises);
        const accessibilityErrors = accessibilityResults.filter(Boolean);
        if (accessibilityErrors.length > 0) {
          console.warn('Some accessibility insertions failed:', accessibilityErrors);
        }
      }

      // Insert participants (both app users and external participants)
      if (eventData.participants && eventData.participants.length > 0) {
        console.log('Inserting participants:', eventData.participants);
        
        const participantPromises = eventData.participants.map(async (participant: any) => {
          console.log('Processing participant:', participant);
          
          const insertData: any = {
            event_id: eventRecord.id,
            is_external: participant.isExternal || false,
          };
          
          if (participant.isExternal) {
            // External participant - use new columns
            insertData.user_id = null; // NULL for external participants
            insertData.external_name = participant.name;
            insertData.external_email = participant.email || null;
            console.log('External participant insert data:', insertData);
          } else {
            // App user - use existing user_id, but validate it exists
            if (!participant.id || participant.id.startsWith('external_participant_')) {
              console.warn('Invalid app user ID for participant:', participant);
              // Skip invalid app users or treat as external
              insertData.user_id = null;
              insertData.external_name = participant.name;
              insertData.external_email = participant.email || null;
              insertData.is_external = true;
            } else {
              insertData.user_id = participant.id;
              insertData.external_name = null;
              insertData.external_email = null;
            }
            console.log('App user participant insert data:', insertData);
          }
          
          const { error } = await supabase
            .from('event_participants')
            .insert(insertData);
          if (error) {
            console.error('Participant insertion error:', error);
          }
          return error;
        });
        
        const participantResults = await Promise.all(participantPromises);
        const participantErrors = participantResults.filter(Boolean);
        if (participantErrors.length > 0) {
          console.warn('Some participant insertions failed:', participantErrors);
        }
      }

      console.log('Database returned event record:', eventRecord);
      console.log('Event record ID:', eventRecord.id, 'Type:', typeof eventRecord.id);

      // Create a properly formatted local event object that matches database structure
      const localEvent: Event = {
        id: String(eventRecord.id), // Ensure ID is always a string
        title: eventData.title,
        type: eventData.type,
        schedule: eventData.schedule || [],
        location: eventData.location,
        city: eventData.city,
        country: eventData.country,
        description: eventData.description,
        organizer: {
          id: currentUser.id,
          name: currentUser.user_metadata?.displayName || 'Event Organizer',
          profileImage: undefined
        },
        professionals: eventData.professionals || [],
        participants: eventData.participants || [], // Include participants
        accessibility: eventData.accessibility || [],
        ticketInfo: eventData.ticketInfo,
        participationType: eventData.participationType || 'audience',
        durationMinutes: eventData.durationMinutes || 60,
        coordinates: eventData.coordinates,
        images: eventData.images,
      };

      // Add to local state immediately for instant UI update
      setEvents(prevEvents => [...prevEvents, localEvent]);

      // Background refresh to sync with database
      setTimeout(async () => {
        try {
          const { data, error } = await supabase.rpc('get_events_with_details');
          
          if (error) {
            console.error('Background refresh error:', error);
            return;
          }

          if (data && data.length > 0) {
            // Extract all unique user IDs for batch fetching
            const userIds = [...new Set(data.map((event: any) => event.created_by).filter(Boolean))] as string[];
            const userNameMap = await fetchUserDisplayNames(userIds);
            
            // Transform events with the user name map
            const transformedEvents: Event[] = data.map((dbEvent: any) => {
              const organizerName = userNameMap[dbEvent.created_by] || 'Event Organizer';
              return transformEventDataSync(dbEvent, organizerName);
            }).filter(Boolean);
            
            setEvents(currentEvents => mergeEventsSmartly(currentEvents, transformedEvents));
          }
        } catch (error) {
          console.error('Background refresh failed:', error);
        }
      }, 2000);

      // Return the created event so the form can use it for navigation
      return localEvent;

    } catch (error) {
      console.error('Error adding event:', error);
      throw error;
    }
  };

  // Update an existing event in Supabase and update local state
  const updateEvent = async (eventId: string, eventData: Event) => {
    if (!user) {
      throw new Error('User must be logged in to update events');
    }

    try {
      const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !currentUser) {
        console.error('User authentication issue:', userError);
        throw new Error('Authentication failed. Please sign in again.');
      }

      // First verify that the current user owns this event
      const { data: eventRecord, error: eventCheckError } = await supabase
        .from('events')
        .select('created_by')
        .eq('id', eventId)
        .single();

      if (eventCheckError) {
        console.error('Error checking event ownership:', eventCheckError);
        throw new Error('Event not found');
      }

      if (eventRecord.created_by !== currentUser.id) {
        throw new Error('You can only edit your own events');
      }

      // Update the main event record
      const eventPayload = {
        title: eventData.title,
        type: eventData.type,
        description: eventData.description || 'No description provided',
        location: eventData.location,
        city: eventData.city,
        country: eventData.country,
        coordinates_lat: eventData.coordinates?.latitude || null,
        coordinates_lng: eventData.coordinates?.longitude || null,
        image_url: eventData.images && eventData.images.length > 0 ? eventData.images[0] : null,
        participation_type: eventData.participationType || 'audience',
        duration_minutes: eventData.durationMinutes || 60,
        updated_at: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from('events')
        .update(eventPayload)
        .eq('id', eventId);

      if (updateError) {
        console.error('Failed to update event:', updateError);
        throw new Error(`Failed to update event: ${updateError.message || 'Unknown database error'}`);
      }

      // Delete existing related data and re-insert
      await Promise.all([
        supabase.from('event_schedules').delete().eq('event_id', eventId),
        supabase.from('event_tickets').delete().eq('event_id', eventId),
        supabase.from('event_accessibility').delete().eq('event_id', eventId),
        supabase.from('event_participants').delete().eq('event_id', eventId),
      ]);

      // Insert updated schedules
      if (eventData.schedule && eventData.schedule.length > 0) {
        const schedulePromises = eventData.schedule.map(async (schedule) => {
          const { error } = await supabase
            .from('event_schedules')
            .insert({
              event_id: eventId,
              start_date: schedule.date,
              end_date: schedule.endDate || null,
            });
          if (error) {
            console.error('Schedule update error:', error);
          }
          return error;
        });
        
        const scheduleResults = await Promise.all(schedulePromises);
        const scheduleErrors = scheduleResults.filter(Boolean);
        if (scheduleErrors.length > 0) {
          console.warn('Some schedule updates failed:', scheduleErrors);
        }
      }

      // Insert updated ticket information
      if (eventData.ticketInfo) {
        const { error: ticketError } = await supabase
          .from('event_tickets')
          .insert({
            event_id: eventId,
            type: eventData.ticketInfo.type,
            price: eventData.ticketInfo.price || null,
            currency: eventData.ticketInfo.currency || null,
            purchase_link: eventData.ticketInfo.purchaseLink || null,
            on_site_available: eventData.ticketInfo.onSiteAvailable || false,
          });
        
        if (ticketError) {
          console.error('Ticket update error:', ticketError);
        }
      }

      // Insert updated accessibility features
      if (eventData.accessibility && eventData.accessibility.length > 0) {
        const accessibilityPromises = eventData.accessibility.map(async (featureType) => {
          const { error } = await supabase
            .from('event_accessibility')
            .insert({
              event_id: eventId,
              feature: featureType,
            });
          if (error) {
            console.error('Accessibility update error:', error);
          }
          return error;
        });
        
        const accessibilityResults = await Promise.all(accessibilityPromises);
        const accessibilityErrors = accessibilityResults.filter(Boolean);
        if (accessibilityErrors.length > 0) {
          console.warn('Some accessibility updates failed:', accessibilityErrors);
        }
      }

      // Insert updated participants
      if (eventData.participants && eventData.participants.length > 0) {
        const participantPromises = eventData.participants.map(async (participant) => {
          console.log('Processing participant for update:', participant);
          
          const insertData: any = {
            event_id: eventId,
            is_external: participant.isExternal || false,
          };
          
          if (participant.isExternal) {
            // External participant - use external fields
            insertData.user_id = null; // NULL for external participants
            insertData.external_name = participant.name;
            insertData.external_email = participant.email || null;
            console.log('External participant insert data:', insertData);
          } else {
            // App user - use existing user_id, but validate it exists
            if (!participant.id || participant.id.startsWith('external_participant_')) {
              console.warn('Invalid app user ID for participant:', participant);
              // Skip invalid app users or treat as external
              insertData.user_id = null;
              insertData.external_name = participant.name;
              insertData.external_email = participant.email || null;
              insertData.is_external = true;
            } else {
              insertData.user_id = participant.id;
              insertData.external_name = null;
              insertData.external_email = null;
            }
          }
          
          const { error } = await supabase
            .from('event_participants')
            .insert(insertData);
          if (error) {
            console.error('Participant update error:', error);
          }
          return error;
        });
        
        const participantResults = await Promise.all(participantPromises);
        const participantErrors = participantResults.filter(Boolean);
        if (participantErrors.length > 0) {
          console.warn('Some participant updates failed:', participantErrors);
        }
      }

      // Update local state immediately for instant UI update
      setEvents(prevEvents => prevEvents.map(event => 
        event.id === eventId ? eventData : event
      ));

      console.log('Event updated successfully:', eventId);

      // Background refresh to sync with database
      setTimeout(async () => {
        try {
          const { data, error } = await supabase.rpc('get_events_with_details');
          
          if (error) {
            console.error('Background refresh error:', error);
            return;
          }

          if (data && data.length > 0) {
            // Extract all unique user IDs for batch fetching
            const userIds = [...new Set(data.map((event: any) => event.created_by).filter(Boolean))] as string[];
            const userNameMap = await fetchUserDisplayNames(userIds);
            
            // Transform events with the user name map
            const transformedEvents: Event[] = data.map((dbEvent: any) => {
              const organizerName = userNameMap[dbEvent.created_by] || 'Event Organizer';
              return transformEventDataSync(dbEvent, organizerName);
            }).filter(Boolean);
            
            setEvents(currentEvents => mergeEventsSmartly(currentEvents, transformedEvents));
          }
        } catch (error) {
          console.error('Background refresh failed:', error);
        }
      }, 2000);

    } catch (error) {
      console.error('Error updating event:', error);
      throw error;
    }
  };

  const deleteEvent = async (eventId: string) => {
    if (!user) {
      throw new Error('User must be logged in to delete events');
    }

    try {
      const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !currentUser) {
        console.error('User authentication issue:', userError);
        throw new Error('Authentication failed. Please sign in again.');
      }

      // First verify that the current user owns this event
      const { data: eventData, error: eventCheckError } = await supabase
        .from('events')
        .select('created_by')
        .eq('id', eventId)
        .single();

      if (eventCheckError) {
        console.error('Error checking event ownership:', eventCheckError);
        throw new Error('Event not found');
      }

      if (eventData.created_by !== currentUser.id) {
        throw new Error('You can only delete your own events');
      }

      // Delete the event (cascade will handle schedules, tickets, etc.)
      const { error: deleteError } = await supabase
        .from('events')
        .delete()
        .eq('id', eventId);

      if (deleteError) {
        console.error('Failed to delete event:', deleteError);
        throw new Error(`Failed to delete event: ${deleteError.message || 'Unknown database error'}`);
      }

      // Remove from local state immediately for instant UI update
      setEvents(prevEvents => prevEvents.filter(event => event.id !== eventId));

      console.log('Event deleted successfully:', eventId);

    } catch (error) {
      console.error('Error deleting event:', error);
      throw error;
    }
  };

  // Calculate available cities based on selected country
  const availableCities = useMemo(() => {
    return COUNTRY_CITIES[filters.selectedCountry] || [];
  }, [filters.selectedCountry]);

  // Calculate available countries
  const availableCountries = useMemo(() => {
    return Object.keys(COUNTRY_CITIES).sort();
  }, []);

  // Calculate filtered events (memoized to prevent unnecessary recalculations)
  const filteredEvents = useMemo(() => {
    const now = new Date();
    
    // First filter out past events (events where all schedule dates are in the past)
    const futureEvents = events.filter(event => {
      if (!event.schedule || event.schedule.length === 0) {
        // If no schedule, include the event (could be TBA)
        return true;
      }
      
      // Check if any scheduled date is in the future
      return event.schedule.some(schedule => {
        if (!schedule || !schedule.date) return false; // Skip invalid schedule entries
        const eventDate = new Date(schedule.date);
        return eventDate > now;
      });
    });
    
    // Sort events by earliest date first (future events only)
    const sortedEvents = [...futureEvents].sort((a, b) => {
      const aDate = a.schedule && a.schedule.length > 0 && a.schedule[0] && a.schedule[0].date 
        ? new Date(a.schedule[0].date) : new Date();
      const bDate = b.schedule && b.schedule.length > 0 && b.schedule[0] && b.schedule[0].date 
        ? new Date(b.schedule[0].date) : new Date();
      return aDate.getTime() - bDate.getTime();
    });
    
    // Filter events by other criteria
    return sortedEvents.filter(event => {
      // Type filter: event passes if 'all' is selected or its type is in selectedTypes
      const passesTypeFilter = filters.selectedTypes.includes('all') || 
                              filters.selectedTypes.includes(event.type);
      
      // Participation type filter: event passes if 'all' is selected or its participation type is in selectedParticipationTypes
      const passesParticipationTypeFilter = filters.selectedParticipationTypes.includes('all') || 
                                           (event.participationType && filters.selectedParticipationTypes.includes(event.participationType)) ||
                                           (!event.participationType && filters.selectedParticipationTypes.includes('audience')); // Default to audience for events without participationType
      
      // Country filter: only show events from selected country
      const passesCountryFilter = event.country === filters.selectedCountry;
      
      // City filter: event passes if 'all' is selected or its city matches
      const passesCityFilter = filters.selectedCity === 'all' || 
                              event.city === filters.selectedCity;
      
      // Map filter: when enabled, check if event is within drawn polygon
      const passesMapFilter = !filters.mapFilterEnabled || 
                             (filters.polygonCoords.length > 2 && 
                              event.coordinates &&
                              isPointInPolygon(
                                { latitude: event.coordinates.latitude, longitude: event.coordinates.longitude }, 
                                filters.polygonCoords
                              ));
      
      // Following filter: when enabled, only show events from followed organizers OR where followed people are participants
      const passesFollowingFilter = !filters.showFollowingOnly || 
                                   favoriteState.favoritePeople.has(event.organizer.id) ||
                                   (event.participants && event.participants.some(participant => 
                                     favoriteState.favoritePeople.has(participant.id)
                                   ));
      
      // Event must pass ALL filters
      return passesTypeFilter && passesParticipationTypeFilter && passesCountryFilter && passesCityFilter && passesMapFilter && passesFollowingFilter;
    });
  }, [events, filters.selectedTypes, filters.selectedParticipationTypes, filters.selectedCountry, filters.selectedCity, filters.mapFilterEnabled, filters.polygonCoords, filters.showFollowingOnly, favoriteState.favoritePeople]);
  
  return (
    <EventsContext.Provider value={{ 
      events, 
      setEvents,
      addEvent,
      updateEvent,
      deleteEvent, 
      filters,
      setSelectedTypes,
      setSelectedParticipationTypes,
      setMapFilterEnabled,
      setDrawingMode,
      setSelectedCity,
      setPolygonCoords,
      setShouldNavigateToMap,
      setSelectedCountry,
      setShowFollowingOnly,
      filteredEvents,
      availableCities,
      availableCountries,
      loading,
      refreshEvents,
      favoriteState,
      favoriteEvent,
      unfavoriteEvent,
      isEventFavorited,
      favoritePerson,
      unfavoritePerson,
      isPersonFavorited,
      updateGlobalNotificationSetting,
      isGlobalNotificationEnabled
    }}>
      {children}
    </EventsContext.Provider>
  );
};

export const useEvents = () => {
  const context = useContext(EventsContext);
  if (context === undefined) {
    throw new Error('useEvents must be used within an EventProvider');
  }
  return context;
};