import { EventType } from '@/context/EventsContext';

// Icon mapping for different event types
export const eventTypeIcons: Record<EventType, string> = {
  music: '🎵',
  art: '🎨',
  theater: '🎭',
  dance: '💃',
  workshop: '🛠️',
  festival: '🎪',
  exhibition: '🖼️',
  film: '🎬',
  literature: '📚',
  other: '🔖'
};

// Event type options with emoji icons for filtering
export const eventTypeOptions: Array<{ type: EventType | 'all'; label: string; icon: string }> = [
  { type: 'all', label: 'All', icon: '🗓️' },
  { type: 'music', label: 'Music', icon: eventTypeIcons.music },
  { type: 'art', label: 'Art', icon: eventTypeIcons.art },
  { type: 'theater', label: 'Theater', icon: eventTypeIcons.theater },
  { type: 'dance', label: 'Dance', icon: eventTypeIcons.dance },
  { type: 'workshop', label: 'Workshop', icon: eventTypeIcons.workshop },
  { type: 'festival', label: 'Festival', icon: eventTypeIcons.festival },
  { type: 'exhibition', label: 'Exhibition', icon: eventTypeIcons.exhibition },
  { type: 'film', label: 'Film', icon: eventTypeIcons.film },
  { type: 'literature', label: 'Literature', icon: eventTypeIcons.literature },
  { type: 'other', label: 'Other', icon: eventTypeIcons.other }
];
