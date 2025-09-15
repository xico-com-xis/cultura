import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { supabase } from '@/lib/supabase';

interface FollowedPerson {
  id: string;
  person_id: string;
  display_name: string;
  full_name?: string;
  avatar_url?: string;
}

export default function PeopleFollowingScreen() {
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const [followedPeople, setFollowedPeople] = useState<FollowedPerson[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      fetchFollowedPeople();
    } else {
      setLoading(false);
    }
  }, [user?.id]);

  const fetchFollowedPeople = async () => {
    try {
      if (!user?.id) return;

      // First get the favorite_people records where user_id is the current user
      const { data: favoriteData, error: favoriteError } = await supabase
        .from('favorite_people')
        .select('id, person_id')
        .eq('user_id', user.id);

      if (favoriteError) {
        console.error('Error fetching favorite people:', favoriteError);
        return;
      }

      if (!favoriteData || favoriteData.length === 0) {
        setFollowedPeople([]);
        return;
      }

      // Get the person IDs that the current user follows
      const followedPersonIds = favoriteData.map(item => item.person_id);

      // Now get the profile information for those people
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, display_name, full_name, avatar_url')
        .in('id', followedPersonIds);

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        return;
      }

      // Combine the data
      const transformedData: FollowedPerson[] = favoriteData.map(favorite => {
        const profile = profilesData?.find(p => p.id === favorite.person_id);
        return {
          id: favorite.id,
          person_id: favorite.person_id,
          display_name: profile?.display_name || 'Unknown User',
          full_name: profile?.full_name,
          avatar_url: profile?.avatar_url
        };
      }).filter(item => item.display_name !== 'Unknown User'); // Filter out users without valid profiles

      setFollowedPeople(transformedData);
    } catch (error) {
      console.error('Error in fetchFollowedPeople:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
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
            <ThemedText style={styles.headerTitle}>Following</ThemedText>
            <View style={{ width: 40 }} />
          </ThemedView>
          <ThemedView style={styles.centerContent}>
            <IconSymbol name="person.circle" size={80} color="#ccc" />
            <ThemedText style={styles.emptyTitle}>Sign In Required</ThemedText>
            <ThemedText style={styles.emptyText}>
              Sign in to follow people and see them here
            </ThemedText>
          </ThemedView>
        </ThemedView>
      </>
    );
  }

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
            <ThemedText style={styles.headerTitle}>Following</ThemedText>
            <View style={{ width: 40 }} />
          </ThemedView>
          <ThemedView style={styles.centerContent}>
            <ThemedText>Loading...</ThemedText>
          </ThemedView>
        </ThemedView>
      </>
    );
  }

  const navigateToOrganizer = (personId: string) => {
    router.push({
      pathname: '/profile/[id]',
      params: { id: personId }
    });
  };

  const renderPersonItem = ({ item }: { item: FollowedPerson }) => (
    <TouchableOpacity 
      style={styles.organizerItem}
      onPress={() => navigateToOrganizer(item.person_id)}
    >
      <View style={styles.organizerContent}>
        {item.avatar_url ? (
          <View style={styles.avatarContainer}>
            <IconSymbol name="person.circle.fill" size={40} color={Colors[colorScheme ?? 'light'].tint} />
          </View>
        ) : (
          <IconSymbol name="person.circle.fill" size={40} color={Colors[colorScheme ?? 'light'].tint} />
        )}
        <View style={styles.organizerText}>
          <ThemedText style={styles.organizerName}>
            {item.display_name || item.full_name || 'Unknown User'}
          </ThemedText>
          <ThemedText style={styles.organizerSubtitle}>Tap to view profile</ThemedText>
        </View>
        <IconSymbol name="chevron.right" size={20} color="#666" />
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <ThemedView style={styles.centerContent}>
      <IconSymbol name="person.2" size={80} color="#ccc" />
      <ThemedText style={styles.emptyTitle}>Not following anyone</ThemedText>
      <ThemedText style={styles.emptyText}>
        Follow people to see them here
      </ThemedText>
    </ThemedView>
  );

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
          <ThemedText style={styles.headerTitle}>Following</ThemedText>
          <View style={{ width: 40 }} />
        </ThemedView>

        {/* People Counter */}
        <ThemedView style={styles.counterContainer}>
          <ThemedText style={styles.counterText}>
            {followedPeople.length} {followedPeople.length === 1 ? 'person' : 'people'} followed
          </ThemedText>
        </ThemedView>

        {/* Content */}
        <ThemedView style={styles.content}>
          {followedPeople.length === 0 ? (
            renderEmptyState()
          ) : (
            <FlatList
              data={followedPeople}
              renderItem={renderPersonItem}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.peopleList}
            />
          )}
        </ThemedView>
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
  counterContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  counterText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  peopleList: {
    paddingTop: 16,
    paddingBottom: 20,
  },
  organizerItem: {
    marginBottom: 12,
    backgroundColor: 'rgba(255, 255, 255, 1)',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  organizerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  organizerText: {
    marginLeft: 12,
    flex: 1,
  },
  organizerName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  organizerSubtitle: {
    fontSize: 14,
    color: '#666',
  },
});