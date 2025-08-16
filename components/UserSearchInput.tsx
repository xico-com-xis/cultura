import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { Organizer } from '@/context/EventsContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { supabase } from '@/lib/supabase';

interface UserSearchInputProps {
  selectedUsers: Organizer[];
  onUsersChange: (users: Organizer[]) => void;
  placeholder?: string;
}

export default function UserSearchInput({ selectedUsers, onUsersChange, placeholder = "Search and tag users..." }: UserSearchInputProps) {
  const colorScheme = useColorScheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Organizer[]>([]);
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

      // Convert profiles to Organizer format and filter out already selected users
      const organizers: Organizer[] = (profiles || [])
        .map(profile => ({
          id: profile.id,
          name: profile.display_name || profile.full_name || 'Unknown User',
          profileImage: profile.avatar_url
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

  const handleUserSelect = (user: Organizer) => {
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

        {/* Search Results Dropdown - Always show when there are results */}
        {searchResults.length > 0 && (
          <View style={[styles.dropdown, { backgroundColor: Colors[colorScheme ?? 'light'].background, borderColor: Colors[colorScheme ?? 'light'].text + '20' }]}>
            <ScrollView 
              style={styles.dropdownList}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled={true}
            >
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
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>

      {/* Selected Users - Moved to bottom for better visibility */}
      {selectedUsers.length > 0 && (
        <View style={[styles.selectedUsersContainer, { backgroundColor: Colors[colorScheme ?? 'light'].background, borderColor: Colors[colorScheme ?? 'light'].tint + '30' }]}>
          <ThemedText style={[styles.sectionLabel, { color: Colors[colorScheme ?? 'light'].tint }]}>
            👥 Tagged Participants ({selectedUsers.length})
          </ThemedText>
          <View style={styles.selectedUsers}>
            {selectedUsers.map((user) => (
              <View key={user.id} style={[styles.selectedUserTag, { backgroundColor: Colors[colorScheme ?? 'light'].tint + '20', borderColor: Colors[colorScheme ?? 'light'].tint + '40' }]}>
                <ThemedText style={[styles.selectedUserText, { color: Colors[colorScheme ?? 'light'].tint }]}>{user.name}</ThemedText>
                <TouchableOpacity 
                  onPress={() => handleRemoveUser(user.id)}
                  style={styles.removeButton}
                  activeOpacity={0.7}
                >
                  <IconSymbol name="xmark" size={14} color={Colors[colorScheme ?? 'light'].tint} />
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
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  selectedUserText: {
    fontSize: 14,
    fontWeight: '500',
  },
  removeButton: {
    padding: 2,
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
  },
});
