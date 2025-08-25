import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import uuid from 'react-native-uuid';

import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { Organizer } from '@/context/EventsContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { supabase } from '@/lib/supabase';

// Enhanced Organizer type to support external participants
export interface ExtendedOrganizer extends Organizer {
  isExternal?: boolean; // Flag to distinguish external participants
  email?: string; // Email for external participants
}

interface UserSearchInputProps {
  selectedUsers: ExtendedOrganizer[];
  onUsersChange: (users: ExtendedOrganizer[]) => void;
  placeholder?: string;
}

export default function UserSearchInput({ selectedUsers, onUsersChange, placeholder = "Search and tag users..." }: UserSearchInputProps) {
  const colorScheme = useColorScheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ExtendedOrganizer[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Search all users in the profiles table
  const searchAllUsers = async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);

    try {
      // Search in profiles table for all users using both display_name and full_name
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

      // Convert profiles to ExtendedOrganizer format and filter out already selected users
      const organizers: ExtendedOrganizer[] = (profiles || [])
        .map(profile => ({
          id: profile.id,
          name: profile.display_name || profile.full_name || 'Unknown User',
          profileImage: profile.avatar_url,
          isExternal: false // These are app users
        }))
        .filter(organizer => !selectedUsers.some(selected => selected.id === organizer.id));

      setSearchResults(organizers);
    } catch (error) {
      console.error('Error searching users:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };


  // Debounce search to avoid too many database calls
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchAllUsers(searchQuery);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, selectedUsers]);

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
  };

  const handleUserSelect = (user: ExtendedOrganizer) => {
    console.log('Selected app user:', user);
    onUsersChange([...selectedUsers, user]);
    setSearchQuery('');
  };

  const handleRemoveUser = (userId: string) => {
    onUsersChange(selectedUsers.filter(user => user.id !== userId));
  };

  return (
    <View style={styles.container}>
      {/* Search Input */}
      <View style={styles.searchContainer}>
        <View style={[styles.searchInputContainer, { borderColor: Colors[colorScheme ?? 'light'].text + '30' }]}>
          <IconSymbol 
            name="magnifyingglass" 
            size={16} 
            color={Colors[colorScheme ?? 'light'].text + '60'} 
            style={styles.searchIcon}
          />
          <TextInput
            style={[styles.searchInput, { color: Colors[colorScheme ?? 'light'].text }]}
            placeholder={placeholder}
            placeholderTextColor={Colors[colorScheme ?? 'light'].text + '60'}
            value={searchQuery}
            onChangeText={handleSearchChange}
          />
          {isSearching && (
            <View style={styles.loadingContainer}>
              <ThemedText style={styles.loadingText}>Searching...</ThemedText>
            </View>
          )}
        </View>

        {/* Search Results Dropdown - Show results or external option when searching */}
        {searchQuery.length > 0 && (
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
                  onPress={() => {
                    // Check for duplicates
                    const isDuplicate = selectedUsers.some(user => 
                      user.isExternal && 
                      user.name.toLowerCase() === searchQuery.trim().toLowerCase()
                    );

                    if (!isDuplicate) {
                      const externalUser: ExtendedOrganizer = {
                        id: uuid.v4() as string, // Generate proper UUID
                        name: searchQuery.trim(),
                        email: '',
                        isExternal: true
                      };
                      handleUserSelect(externalUser);
                    }
                    setSearchQuery('');
                  }}
                  activeOpacity={0.7}
                >
                  <IconSymbol 
                    name="person.badge.plus" 
                    size={20} 
                    color="#666666" 
                  />
                  <View style={styles.externalDropdownContent}>
                    <ThemedText style={[styles.dropdownItemText, styles.externalDropdownText]}>
                      Add "{searchQuery.trim()}" as external participant
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

      {/* Selected Users - Enhanced to show external vs app users */}
      {selectedUsers.length > 0 && (
        <View style={[styles.selectedUsersContainer, { backgroundColor: Colors[colorScheme ?? 'light'].background, borderColor: Colors[colorScheme ?? 'light'].tint + '30' }]}>
          <ThemedText style={[styles.sectionLabel, { color: Colors[colorScheme ?? 'light'].tint }]}>
            👥 Tagged Participants ({selectedUsers.length})
          </ThemedText>
          <View style={styles.selectedUsers}>
            {selectedUsers.map((user) => (
              <View key={user.id} style={[
                styles.selectedUserTag, 
                { 
                  backgroundColor: user.isExternal ? '#F0F0F0' : '#E8F4FF',
                  borderColor: user.isExternal ? '#CCCCCC' : '#4C8BF5'
                }
              ]}>
                <View style={styles.selectedUserInfo}>
                  <Text 
                    style={[
                      styles.selectedUserText,
                      { 
                        color: user.isExternal ? '#333333' : '#4C8BF5',
                      }
                    ]}
                  >
                    {user.name || 'No name'}
                  </Text>
                  {user.isExternal && user.email && (
                    <Text 
                      style={[styles.selectedUserSubtext, { color: '#666666' }]}
                    >
                      {user.email}
                    </Text>
                  )}
                </View>
                <TouchableOpacity 
                  onPress={() => handleRemoveUser(user.id)}
                  style={styles.removeButton}
                  activeOpacity={0.7}
                >
                  <IconSymbol name="xmark" size={12} color={user.isExternal ? '#666666' : '#4C8BF5'} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  selectedUsersContainer: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  selectedUsers: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectedUserTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    minHeight: 44, // Increased minimum height
    minWidth: 120, // Reasonable minimum width for text
    alignSelf: 'flex-start', // Don't stretch to full width
  },
  selectedUserInfo: {
    flex: 1,
    marginRight: 8,
    overflow: 'hidden',
  },
  selectedUserText: {
    fontSize: 13,
    fontWeight: '500',
  },
  selectedUserSubtext: {
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 1,
  },
  removeButton: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0, // Prevent button from shrinking
  },
  searchContainer: {
    position: 'relative',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  loadingContainer: {
    marginLeft: 8,
  },
  loadingText: {
    fontSize: 12,
    opacity: 0.6,
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
    zIndex: 2000, // Higher z-index to ensure it's on top
  },
  dropdownList: {
    maxHeight: 200,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16, // Increased padding for better touch target
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
    minHeight: 56, // Ensure good touch target size
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
  // External dropdown styles
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
