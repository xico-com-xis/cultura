import React, { useState, useRef, useEffect } from 'react';
import { View, TextInput, StyleSheet, Text, TouchableOpacity, ScrollView } from 'react-native';
import uuid from 'react-native-uuid';

import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { supabase } from '@/lib/supabase';

// Enhanced Organizer type to support external participants
export interface ExtendedOrganizer {
  id: string;
  name: string;
  profileImage?: string;
  isExternal?: boolean;
  email?: string;
}

interface SmartTextInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onParticipantsChange: (participants: ExtendedOrganizer[]) => void;
  placeholder?: string;
  style?: any;
  multiline?: boolean;
  numberOfLines?: number;
}

interface MentionData {
  id: string;
  name: string;
  startIndex: number;
  endIndex: number;
  isExternal: boolean;
}

export default function SmartTextInput({
  value,
  onChangeText,
  onParticipantsChange,
  placeholder,
  style,
  multiline = false,
  numberOfLines
}: SmartTextInputProps) {
  const colorScheme = useColorScheme();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ExtendedOrganizer[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [mentionStart, setMentionStart] = useState(-1);
  const [mentions, setMentions] = useState<MentionData[]>([]);
  const lastKnownMentionsRef = useRef<MentionData[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const latestTextRef = useRef<string>('');
  const textInputRef = useRef<TextInput>(null);

  // Sync mentions state with value prop
  useEffect(() => {
    const { mentions: currentMentions, participants } = parseMentions(value);
    console.log('📝 useEffect - value changed:', value);
    console.log('📝 useEffect - parsed mentions:', currentMentions);
    console.log('📝 useEffect - parsed participants:', participants);
    
    // CRITICAL FIX: Don't clear mentions if we're in mention mode and value becomes plain text
    // This prevents losing existing mentions when user starts typing a new mention
    if (mentionStart === -1 || currentMentions.length > 0) {
      // Only update mentions if:
      // 1. We're not in mention mode, OR
      // 2. We found actual mentions (not plain text)
      setMentions(currentMentions);
      // Save good mentions to ref for recovery during mention mode
      if (currentMentions.length > 0) {
        lastKnownMentionsRef.current = currentMentions;
      }
      console.log('📝 useEffect - updating mentions to:', currentMentions);
    } else {
      console.log('📝 useEffect - skipping mentions update (in mention mode with plain text)');
    }
  }, [value, mentionStart]);

  // Search users in the profiles table
  const searchAllUsers = async (query: string) => {
    if (!query.trim() || query.length < 1) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);

    try {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, display_name, full_name, avatar_url')
        .or(`display_name.ilike.%${query}%,full_name.ilike.%${query}%`)
        .limit(10);

      if (error) {
        console.error('Error searching users:', error);
        setSearchResults([]);
        return;
      }

      const organizers: ExtendedOrganizer[] = (profiles || [])
        .map(profile => ({
          id: profile.id,
          name: profile.display_name || profile.full_name || 'Unknown User',
          profileImage: profile.avatar_url,
          isExternal: false
        }));

      setSearchResults(organizers);
    } catch (error) {
      console.error('Error searching users:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Parse text to find mentions and extract participants
  const parseMentions = (text: string): { mentions: MentionData[], participants: ExtendedOrganizer[] } => {
    const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
    const foundMentions: MentionData[] = [];
    const participants: ExtendedOrganizer[] = [];
    let match;

    while ((match = mentionRegex.exec(text)) !== null) {
      const [fullMatch, displayName, userId] = match;
      const startIndex = match.index;
      const endIndex = startIndex + fullMatch.length;
      
      const mention: MentionData = {
        id: userId,
        name: displayName,
        startIndex,
        endIndex,
        isExternal: userId.startsWith('external_participant_')
      };
      
      foundMentions.push(mention);
      
      // Add to participants
      participants.push({
        id: userId,
        name: displayName,
        isExternal: mention.isExternal,
        email: mention.isExternal ? '' : undefined
      });
    }

    return { mentions: foundMentions, participants };
  };

  // Convert mentions back to display text with highlighted @mentions
  const getDisplayTextWithMentions = (text: string): React.ReactNode[] => {
    const { mentions } = parseMentions(text);
    
    if (mentions.length === 0) {
      return [text];
    }

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;

    mentions.forEach((mention, index) => {
      // Add text before mention
      if (mention.startIndex > lastIndex) {
        parts.push(text.substring(lastIndex, mention.startIndex));
      }

      // Add mention as highlighted @name
      parts.push(
        <Text key={`mention-${index}`} style={styles.mentionText}>
          @{mention.name}
        </Text>
      );

      lastIndex = mention.endIndex;
    });

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts;
  };

  // Convert mentions back to display text (showing just names, underlined in blue)
  const getDisplayText = (text: string): React.ReactNode[] => {
    const { mentions } = parseMentions(text);
    
    if (mentions.length === 0) {
      return [text];
    }

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;

    mentions.forEach((mention, index) => {
      // Add text before mention
      if (mention.startIndex > lastIndex) {
        parts.push(text.substring(lastIndex, mention.startIndex));
      }

      // Add mention as styled text
      parts.push(
        <Text key={`mention-${index}`} style={styles.mentionText}>
          {mention.name}
        </Text>
      );

      lastIndex = mention.endIndex;
    });

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts;
  };

  // Convert plain text changes back to markup format while preserving existing mentions
  const syncTextChanges = (newPlainText: string, oldMarkupText: string): string => {
    const oldPlainText = getPlainDisplayText(oldMarkupText);
    
    // If texts are identical, no change needed
    if (newPlainText === oldPlainText) {
      return oldMarkupText;
    }
    
    // Parse existing mentions from the markup
    const { mentions } = parseMentions(oldMarkupText);
    
    // If no mentions exist, just return the plain text
    if (mentions.length === 0) {
      return newPlainText;
    }
    
    // For now, let's use a simple approach: if the user is typing new content
    // and not modifying existing mentions, preserve the markup structure
    // This is a simplified implementation - a full solution would require
    // more sophisticated text diff algorithms
    
    // If the new text is longer (user added text), try to preserve mentions
    if (newPlainText.length > oldPlainText.length) {
      // User likely added text, try to preserve existing mentions
      // For simplicity, return the plain text and let mentions be re-detected
      return newPlainText;
    }
    
    // If text is shorter (user deleted text), check if mentions were affected
    if (newPlainText.length < oldPlainText.length) {
      // User deleted text, check if any mentions were removed
      const mentionsStillPresent = mentions.every(mention => 
        newPlainText.includes(mention.name)
      );
      
      if (mentionsStillPresent) {
        // All mentions still present, try to reconstruct markup
        // This is complex, so for now just return plain text
        return newPlainText;
      } else {
        // Some mentions were removed, return plain text
        return newPlainText;
      }
    }
    
    // Default case: return new plain text
    return newPlainText;
  };

  const handleTextChange = (text: string) => {
    onChangeText(text);
    
    // Update mentions and notify parent of participants
    const { mentions: currentMentions, participants } = parseMentions(text);
    setMentions(currentMentions);
    onParticipantsChange(participants);
  };

  // Helper function to get the current typed text (what user is actually typing)
  const getCurrentTypedText = () => {
    if (mentionStart === -1) return '';
    const currentPlainText = getPlainDisplayText(value);
    const textAfterAt = currentPlainText.substring(mentionStart + 1, cursorPosition);
    return textAfterAt.split(/[\s\n\t]/)[0] || '';
  };

  // Handle @ detection when cursor position changes
  const handleAtDetection = (text: string, cursorPos: number) => {
    console.log('🔍 handleAtDetection called with text:', `"${text}"`, 'cursorPos:', cursorPos);
    console.log('🔍 latestTextRef.current:', `"${latestTextRef.current}"`);
    
    // Only process if this text is newer (longer or different) than what we've seen
    if (text.length < latestTextRef.current.length) {
      console.log('🔍 Ignoring older/shorter text');
      return;
    }
    
    latestTextRef.current = text;
    
    const textBeforeCursor = text.substring(0, cursorPos);
    console.log('🔍 textBeforeCursor:', `"${textBeforeCursor}"`);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    console.log('🔍 lastAtIndex:', lastAtIndex);
    
    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      console.log('🔍 textAfterAt (searchQuery):', `"${textAfterAt}"`);
      
      // Check if we're in a mention (no spaces after @)
      if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
        setMentionStart(lastAtIndex);
        setSearchQuery(textAfterAt);
        setShowSuggestions(true);
        searchAllUsers(textAfterAt);
      } else {
        setShowSuggestions(false);
        setMentionStart(-1);
      }
    } else {
      setShowSuggestions(false);
      setMentionStart(-1);
    }
  };

  const handleSelectionChange = (event: any) => {
    const newCursorPosition = event.nativeEvent.selection.start;
    setCursorPosition(newCursorPosition);
    
    // Handle @ detection when cursor position changes
    handleAtDetection(getPlainDisplayText(value), newCursorPosition);
  };

  const handleUserSelect = (user: ExtendedOrganizer, isExternal: boolean = false) => {
    console.log('🎯 handleUserSelect called with:', { user, isExternal, mentionStart, searchQuery });
    
    if (mentionStart === -1) return;

    let selectedUser = user;
    
    // If creating external user, extract the actual typed text instead of using potentially stale searchQuery
    if (isExternal) {
      // Get current plain text and extract what the user actually typed
      const currentPlainText = getPlainDisplayText(value);
      const textAfterAt = currentPlainText.substring(mentionStart + 1, cursorPosition);
      const actualTypedName = textAfterAt.split(/[\s\n\t]/)[0] || searchQuery;
      
      console.log('🎯 Creating external participant with actualTypedName:', actualTypedName);
      console.log('🎯 currentPlainText:', currentPlainText);
      console.log('🎯 textAfterAt:', textAfterAt);
      console.log('🎯 cursorPosition:', cursorPosition);
      console.log('🎯 mentionStart:', mentionStart);
      console.log('🎯 originalSearchQuery:', searchQuery);
      console.log('🎯 actualTypedName.trim():', actualTypedName.trim());
      
      selectedUser = {
        id: `external_participant_${uuid.v4()}`,
        name: actualTypedName.trim(), // Use the actual typed text
        isExternal: true,
        email: ''
      };
      console.log('🎯 External selectedUser created:', selectedUser);
    }

    console.log('🎯 selectedUser:', selectedUser);

    // Create the mention markup
    const mentionMarkup = `@[${selectedUser.name}](${selectedUser.id})`;
    console.log('🎯 mentionMarkup:', mentionMarkup);
    
    // CRITICAL FIX: We need to preserve ALL existing mentions, not just replace in current value
    // The current value might be plain text if user was typing a mention
    
    // Get all existing mentions from the original markup value (before any plain text conversion)
    // We need to reconstruct the text properly
    
    let newMarkupText;
    
    // Strategy: Build the text by preserving all mentions that were in the original text
    // and adding the new mention
    
    // First, let's see if we can find existing mentions in any previous state
    // For now, let's use a simpler approach: rebuild from the current participants state
    
    // Get existing participants from the form state (more reliable than parsing potentially corrupted text)
    // CRITICAL: When in mention mode, the mentions state might be empty because text was converted to plain
    // We need to get mentions from the original markup value or use saved reference
    let existingParticipants = mentions || [];
    
    // If mentions state is empty but we know there should be participants, use the last known good mentions
    // This happens when user enters mention mode and text gets converted to plain text
    if (existingParticipants.length === 0 && lastKnownMentionsRef.current.length > 0) {
      existingParticipants = lastKnownMentionsRef.current;
      console.log('🎯 Using lastKnownMentions:', existingParticipants);
    }
    
    console.log('🎯 existingParticipants from state:', existingParticipants);
    
    // CRITICAL FIX: Preserve text structure by inserting the new mention at the correct position
    // Get the current plain text (what user sees)
    const currentPlainText = getPlainDisplayText(value);
    console.log('🎯 currentPlainText:', currentPlainText);
    
    // Find the actual text that needs to be replaced (from @ to current cursor or space/end)
    const beforeMention = currentPlainText.substring(0, mentionStart);
    
    // Find where the mention text ends - should be at current cursor position when user selects suggestion
    let mentionEndIndex = cursorPosition; // Use cursor position instead of searching
    
    // If cursor position is not available or seems wrong, fall back to search method
    if (mentionEndIndex <= mentionStart) {
      mentionEndIndex = mentionStart + 1; // Start after the @
      while (mentionEndIndex < currentPlainText.length) {
        const char = currentPlainText[mentionEndIndex];
        if (char === ' ' || char === '\n' || char === '@') {
          break;
        }
        mentionEndIndex++;
      }
    }
    
    const afterMention = currentPlainText.substring(mentionEndIndex);
    console.log('🎯 beforeMention:', `"${beforeMention}"`);
    console.log('🎯 mentionStart:', mentionStart);
    console.log('🎯 cursorPosition:', cursorPosition);
    console.log('🎯 mentionEndIndex:', mentionEndIndex);
    console.log('🎯 afterMention:', `"${afterMention}"`);
    console.log('🎯 selectedUser.name:', `"${selectedUser.name}"`);
    
    const newPlainText = beforeMention + `@${selectedUser.name}` + afterMention;
    console.log('🎯 newPlainText:', `"${newPlainText}"`);
    
    // Now rebuild markup text by converting plain text mentions back to markup
    // This preserves the original text structure
    let markupText = newPlainText;
    
    // Convert existing mentions to markup (preserve their positions)
    const existingMentionsWithNames = existingParticipants.map(m => ({
      name: m.name,
      id: m.id,
      isExternal: m.isExternal || false
    }));
    
    // Add the new mention to the list
    const allMentionsToReplace = [...existingMentionsWithNames];
    const isDuplicate = allMentionsToReplace.some(m => m.id === selectedUser.id);
    if (!isDuplicate) {
      allMentionsToReplace.push({
        name: selectedUser.name,
        id: selectedUser.id,
        isExternal: selectedUser.isExternal || false
      });
    }
    
    console.log('🎯 allMentionsToReplace:', allMentionsToReplace);
    
    // Replace all @name patterns with @[name](id) markup
    allMentionsToReplace.forEach(mention => {
      const mentionPattern = new RegExp(`@${mention.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g');
      markupText = markupText.replace(mentionPattern, `@[${mention.name}](${mention.id})`);
    });
    
    newMarkupText = markupText;
    console.log('🎯 final newMarkupText:', newMarkupText);
    
    // Update the text
    onChangeText(newMarkupText);
    
    // Update mentions and participants
    const { mentions: newMentions, participants } = parseMentions(newMarkupText);
    console.log('🎯 parsed newMentions:', newMentions);
    console.log('🎯 parsed participants:', participants);
    
    setMentions(newMentions);
    onParticipantsChange(participants);

    setShowSuggestions(false);
    setMentionStart(-1);
    setSearchQuery('');
    
    // Reset the latest text ref to prepare for next mention
    latestTextRef.current = '';

    // Set cursor position after the mention (@name)
    const newCursorPosition = mentionStart + selectedUser.name.length + 1; // +1 for the @ symbol
    
    setTimeout(() => {
      if (textInputRef.current) {
        textInputRef.current.focus();
        // Force cursor position in the plain text view
        textInputRef.current.setNativeProps({
          selection: { start: newCursorPosition, end: newCursorPosition }
        });
        setCursorPosition(newCursorPosition);
      }
    }, 10);
  };

  // Get plain text for display (convert markup to @name format)
  const getPlainDisplayText = (text: string): string => {
    return text.replace(/@\[([^\]]+)\]\([^)]+\)/g, '@$1');
  };

  return (
    <View style={styles.container}>
      <TextInput
        ref={textInputRef}
        style={[style, { color: Colors[colorScheme ?? 'light'].text }]}
        value={getPlainDisplayText(value)}
        onChangeText={(plainText) => {
          console.log('⌨️ TextInput onChangeText called with:', plainText);
          console.log('⌨️ Current value:', value);
          console.log('⌨️ mentionStart:', mentionStart);
          
          // Handle @ detection for new text - use text length as cursor position
          // since the actual cursor position might not be updated yet
          handleAtDetection(plainText, plainText.length);
          
          // CRITICAL FIX: Don't just pass plainText to onChangeText 
          // because that loses all markup. Instead, preserve existing mentions
          // and only update the non-mention parts
          
          if (mentionStart !== -1) {
            console.log('⌨️ In mention mode - using plain text but will preserve mentions on selection');
            // During mention typing, allow plain text input
            // The mentions will be preserved when user selects from dropdown
            onChangeText(plainText);
            
            // Update search query
            const textBeforeCursor = plainText.substring(0, cursorPosition);
            const lastAtIndex = textBeforeCursor.lastIndexOf('@');
            
            if (lastAtIndex !== -1) {
              const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
              setSearchQuery(textAfterAt);
              searchAllUsers(textAfterAt);
            }
          } else {
            console.log('⌨️ Not in mention mode - preserving existing mentions');
            // User is typing regular text - preserve existing mentions
            // This is the key fix: don't lose markup when typing regular text
            
            // Get current mentions from the markup value
            const { mentions: existingMentions } = parseMentions(value);
            console.log('⌨️ existingMentions:', existingMentions);
            
            if (existingMentions.length === 0) {
              console.log('⌨️ No existing mentions - using plain text');
              // No existing mentions, just use plain text
              onChangeText(plainText);
            } else {
              console.log('⌨️ Has existing mentions - preserving them');
              // There are existing mentions - need to preserve them
              // For now, we'll use a simple approach: only allow typing at the end
              // More sophisticated text editing would require complex diff logic
              
              const currentPlainText = getPlainDisplayText(value);
              console.log('⌨️ currentPlainText:', currentPlainText);
              
              // Check if user is just adding text at the end
              if (plainText.startsWith(currentPlainText)) {
                console.log('⌨️ Adding text at end');
                // Adding text at end - preserve markup and append new text
                const addedText = plainText.substring(currentPlainText.length);
                const newValue = value + addedText;
                console.log('⌨️ newValue:', newValue);
                onChangeText(newValue);
              } else if (currentPlainText.startsWith(plainText)) {
                console.log('⌨️ Deleting text from end');
                // User deleted some text from the end - trim the markup accordingly
                // This is simplified - in production you'd want more sophisticated handling
                const deletedLength = currentPlainText.length - plainText.length;
                const newMarkupLength = Math.max(0, value.length - deletedLength);
                const newValue = value.substring(0, newMarkupLength);
                console.log('⌨️ newValue after deletion:', newValue);
                onChangeText(newValue);
              } else {
                console.log('⌨️ Complex edit detected - trying to preserve mentions anyway');
                // CRITICAL FIX: Instead of falling back to plain text and losing all mentions,
                // try to preserve existing mentions and just update the non-mention text
                
                // Extract all existing mentions
                const existingMentionMarkups = [];
                existingMentions.forEach(mention => {
                  existingMentionMarkups.push(`@[${mention.name}](${mention.id})`);
                });
                
                // Remove all @mentions from the plain text to get just the regular text
                const plainTextWithoutMentions = plainText.replace(/@\w+/g, '').trim();
                
                // Rebuild: existing mentions + new plain text
                let rebuiltText = existingMentionMarkups.join(' ');
                if (plainTextWithoutMentions) {
                  if (rebuiltText.length > 0) rebuiltText += ' ';
                  rebuiltText += plainTextWithoutMentions;
                }
                
                console.log('⌨️ rebuiltText for complex edit:', rebuiltText);
                onChangeText(rebuiltText);
              }
            }
          }
        }}
        onSelectionChange={handleSelectionChange}
        placeholder={placeholder}
        multiline={multiline}
        numberOfLines={numberOfLines}
        placeholderTextColor={Colors[colorScheme ?? 'light'].text + '60'}
        selectionColor={Colors[colorScheme ?? 'light'].tint}
      />

      {/* Show tagged participants separately below the input */}
      {mentions.length > 0 && (
        <View style={styles.taggedParticipants}>
          <ThemedText style={styles.taggedLabel}>Tagged participants:</ThemedText>
          <View style={styles.tagsContainer}>
            {mentions.map((mention, index) => (
              <View key={`${mention.id}-${index}`} style={[
                styles.tagItem,
                { 
                  backgroundColor: mention.isExternal ? '#F0F0F0' : '#E8F4FF',
                  borderColor: mention.isExternal ? '#CCCCCC' : '#4C8BF5'
                }
              ]}>
                <Text style={[
                  styles.tagText,
                  { color: mention.isExternal ? '#333333' : '#4C8BF5' }
                ]}>
                  {mention.name}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Suggestions dropdown */}
      {showSuggestions && (
        <View style={[styles.dropdown, { backgroundColor: Colors[colorScheme ?? 'light'].background, borderColor: Colors[colorScheme ?? 'light'].text + '20' }]}>
          <ScrollView 
            style={styles.dropdownList}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
          >
            {/* App User Results */}
            {searchResults.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.dropdownItem}
                onPress={() => handleUserSelect(item)}
                activeOpacity={0.7}
              >
                <IconSymbol 
                  name="person.circle" 
                  size={20} 
                  color={Colors[colorScheme ?? 'light'].text} 
                />
                <ThemedText style={styles.dropdownItemText}>{item.name}</ThemedText>
                <View style={[styles.userTypeBadge, { backgroundColor: Colors[colorScheme ?? 'light'].tint + '20' }]}>
                  <ThemedText style={[styles.userTypeBadgeText, { color: Colors[colorScheme ?? 'light'].tint }]}>
                    App User
                  </ThemedText>
                </View>
              </TouchableOpacity>
            ))}
            
            {/* External Participant Option */}
            {searchQuery.trim().length > 0 && (
              <TouchableOpacity
                style={[styles.dropdownItem, styles.externalDropdownItem]}
                onPress={() => handleUserSelect({} as ExtendedOrganizer, true)}
                activeOpacity={0.7}
              >
                <IconSymbol 
                  name="person.badge.plus" 
                  size={20} 
                  color="#666666" 
                />
                <View style={styles.externalDropdownContent}>
                  <ThemedText style={[styles.dropdownItemText, styles.externalDropdownText]}>
                    Add "{getCurrentTypedText() || searchQuery.trim()}" as external participant
                  </ThemedText>
                  <ThemedText style={[styles.externalDropdownSubtext, { color: Colors[colorScheme ?? 'light'].text + '60' }]}>
                    External participant (no app account)
                  </ThemedText>
                </View>
                <View style={[styles.userTypeBadge, { backgroundColor: '#F0F0F0' }]}>
                  <ThemedText style={[styles.userTypeBadgeText, { color: '#666666' }]}>
                    External
                  </ThemedText>
                </View>
              </TouchableOpacity>
            )}
            
            {/* No Results Message */}
            {searchResults.length === 0 && searchQuery.length > 2 && (
              <View style={styles.noResultsContainer}>
                <ThemedText style={[styles.noResultsText, { color: Colors[colorScheme ?? 'light'].text + '60' }]}>
                  No app users found for "{searchQuery}"
                </ThemedText>
              </View>
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  taggedParticipants: {
    marginTop: 8,
    padding: 8,
    backgroundColor: 'rgba(76, 139, 245, 0.05)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(76, 139, 245, 0.2)',
  },
  taggedLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    color: '#4C8BF5',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagItem: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '500',
  },
  suggestionsList: {
    maxHeight: 150,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fff',
  },
  suggestionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  suggestionText: {
    fontSize: 16,
    color: '#333',
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    borderWidth: 1,
    borderRadius: 8,
    marginTop: 4,
    maxHeight: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 3000,
  },
  dropdownList: {
    maxHeight: 200,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
    minHeight: 56,
  },
  dropdownItemText: {
    fontSize: 14,
    flex: 1,
  },
  userTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  userTypeBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  externalDropdownItem: {
    backgroundColor: 'rgba(240, 240, 240, 0.3)',
  },
  externalDropdownContent: {
    flex: 1,
  },
  externalDropdownText: {
    fontStyle: 'italic',
  },
  externalDropdownSubtext: {
    fontSize: 12,
    marginTop: 2,
  },
  noResultsContainer: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
});
