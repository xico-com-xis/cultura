import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { ThemedText } from './ThemedText';
import { Colors } from '../constants/Colors';
import { useColorScheme } from '../hooks/useColorScheme';

interface ClickableMentionsProps {
  text: string;
  style?: any;
  participants?: Array<{
    id: string;
    name: string;
    status?: 'pending' | 'accepted' | 'declined';
    isExternal?: boolean;
  }>;
}

interface MentionMatch {
  fullMatch: string;
  displayName: string;
  userId: string;
  startIndex: number;
  endIndex: number;
}

export default function ClickableMentions({ text, style, participants = [] }: ClickableMentionsProps) {
  const colorScheme = useColorScheme();

  // Get participant status by ID
  const getParticipantStatus = (userId: string) => {
    const participant = participants.find(p => p.id === userId);
    return participant?.status || 'accepted'; // Default to accepted for backwards compatibility
  };

  const isExternalParticipant = (userId: string) => {
    const participant = participants.find(p => p.id === userId);
    return participant?.isExternal || userId.startsWith('external_');
  };

  // Parse mentions from text - looking for @[Name](id) pattern
  const parseMentionsFromText = (inputText: string): MentionMatch[] => {
    const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
    const mentions: MentionMatch[] = [];
    let match;

    while ((match = mentionRegex.exec(inputText)) !== null) {
      mentions.push({
        fullMatch: match[0],
        displayName: match[1],
        userId: match[2],
        startIndex: match.index,
        endIndex: match.index + match[0].length
      });
    }

    return mentions;
  };

  const navigateToProfile = (userId: string) => {
    // Only navigate if it's not an external participant (external IDs start with "external_")
    if (!userId.startsWith('external_')) {
      router.push({
        pathname: '/profile/[id]',
        params: { id: userId }
      });
    }
  };

  const renderTextWithMentions = () => {
    const mentions = parseMentionsFromText(text);
    
    if (mentions.length === 0) {
      // No mentions, return plain text
      return <ThemedText style={style}>{text}</ThemedText>;
    }

    const elements: React.ReactNode[] = [];
    let lastIndex = 0;

    mentions.forEach((mention, index) => {
      // Add text before mention
      if (mention.startIndex > lastIndex) {
        elements.push(
          <ThemedText key={`text-${index}`} style={style}>
            {text.substring(lastIndex, mention.startIndex)}
          </ThemedText>
        );
      }

      // Add mention as clickable text or plain text based on status and type
      const isExternal = isExternalParticipant(mention.userId);
      const status = getParticipantStatus(mention.userId);
      
      if (isExternal) {
        // External participants - non-clickable but styled
        elements.push(
          <ThemedText 
            key={`mention-${index}`} 
            style={[
              style,
              {
                color: '#666666',
                fontWeight: '600',
                textDecorationLine: 'underline'
              }
            ]}
          >
            @{mention.displayName}
          </ThemedText>
        );
      } else if (status === 'accepted') {
        // Accepted app users - clickable and blue
        elements.push(
          <Text
            key={`mention-${index}`}
            onPress={() => navigateToProfile(mention.userId)}
            style={[
              style,
              {
                color: Colors[colorScheme ?? 'light'].tint,
                fontWeight: '600',
                textDecorationLine: 'underline'
              }
            ]}
          >
            @{mention.displayName}
          </Text>
        );
      } else if (status === 'pending') {
        // Pending requests - gray and non-clickable
        elements.push(
          <ThemedText 
            key={`mention-${index}`} 
            style={[
              style,
              {
                color: '#999999',
                fontWeight: '600',
                fontStyle: 'italic'
              }
            ]}
          >
            @{mention.displayName}
          </ThemedText>
        );
      } else if (status === 'declined') {
        // Declined requests - strikethrough and gray
        elements.push(
          <ThemedText 
            key={`mention-${index}`} 
            style={[
              style,
              {
                color: '#999999',
                fontWeight: '400',
                textDecorationLine: 'line-through'
              }
            ]}
          >
            @{mention.displayName}
          </ThemedText>
        );
      }

      lastIndex = mention.endIndex;
    });

    // Add remaining text after last mention
    if (lastIndex < text.length) {
      elements.push(
        <ThemedText key="text-end" style={style}>
          {text.substring(lastIndex)}
        </ThemedText>
      );
    }

    return (
      <Text style={style}>
        {elements}
      </Text>
    );
  };

  return renderTextWithMentions();
}
