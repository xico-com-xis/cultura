import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { ThemedView } from '../components/ThemedView';
import { ThemedText } from '../components/ThemedText';
import { IconSymbol } from '../components/ui/IconSymbol';
import { Colors } from '../constants/Colors';
import { useColorScheme } from '../hooks/useColorScheme';

interface Follower {
  id: string;
  user_id: string;
  display_name: string;
  full_name: string;
  avatar_url: string | null;
  created_at: string;
}

export default function PeopleFollowersScreen() {
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme();

  const fetchFollowers = async () => {
    if (!user?.id) return;

    try {
      // Get records where person_id is the current user (people who follow me)
      // Note: This query might be restricted by RLS policies
      const { data: favoriteData, error: favoriteError } = await supabase
        .from('favorite_people')
        .select('id, user_id, created_at')
        .eq('person_id', user.id);

      if (favoriteError) {
        console.error('Error fetching favorite people:', favoriteError);
        Alert.alert('Error', 'Failed to load followers');
        return;
      }

      if (!favoriteData || favoriteData.length === 0) {
        setFollowers([]);
        return;
      }

      // Get the user IDs of people who follow the current user
      const followerUserIds = favoriteData.map(item => item.user_id);

      // Now get the profile information for those users
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, display_name, full_name, avatar_url')
        .in('id', followerUserIds);

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        Alert.alert('Error', 'Failed to load follower profiles');
        return;
      }

      // Combine the data
      const transformedData = favoriteData.map(favorite => {
        const profile = profilesData?.find(p => p.id === favorite.user_id);
        return {
          id: favorite.id,
          user_id: favorite.user_id,
          display_name: profile?.display_name || 'Unknown User',
          full_name: profile?.full_name || '',
          avatar_url: profile?.avatar_url || null,
          created_at: favorite.created_at,
        };
      }) || [];

      setFollowers(transformedData);
    } catch (error) {
      console.error('Error fetching followers:', error);
      Alert.alert('Error', 'Failed to load followers');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchFollowers();
  }, [user?.id]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchFollowers();
  };

  const navigateToProfile = (userId: string) => {
    router.push({
      pathname: '/profile/[id]',
      params: { id: userId }
    });
  };

  const followerCount = useMemo(() => followers.length, [followers]);

  const renderFollowerItem = ({ item }: { item: Follower }) => (
    <TouchableOpacity 
      style={styles.followerItem}
      onPress={() => navigateToProfile(item.user_id)}
    >
      <View style={styles.followerContent}>
        {item.avatar_url ? (
          <View style={styles.avatarContainer}>
            <IconSymbol name="person.circle.fill" size={40} color={Colors[colorScheme ?? 'light'].tint} />
          </View>
        ) : (
          <IconSymbol name="person.circle.fill" size={40} color={Colors[colorScheme ?? 'light'].tint} />
        )}
        <View style={styles.followerText}>
          <ThemedText style={styles.followerName}>
            {item.display_name || item.full_name || 'Unknown User'}
          </ThemedText>
          <ThemedText style={styles.followerSubtitle}>
            Following since {new Date(item.created_at).toLocaleDateString()}
          </ThemedText>
        </View>
        <IconSymbol name="chevron.right" size={20} color="#666" />
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <ThemedView style={styles.centerContent}>
      <IconSymbol name="person.2" size={80} color="#ccc" />
      <ThemedText style={styles.emptyTitle}>No followers yet</ThemedText>
      <ThemedText style={styles.emptyText}>
        When people follow you, they'll appear here
      </ThemedText>
    </ThemedView>
  );

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
            <ThemedText style={styles.headerTitle}>Followers</ThemedText>
            <View style={{ width: 40 }} />
          </ThemedView>
          <ThemedView style={styles.centerContent}>
            <IconSymbol name="person.circle" size={80} color="#ccc" />
            <ThemedText style={styles.emptyTitle}>Sign In Required</ThemedText>
            <ThemedText style={styles.emptyText}>
              Sign in to see your followers here
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
            <ThemedText style={styles.headerTitle}>Followers</ThemedText>
            <View style={{ width: 40 }} />
          </ThemedView>
          <ThemedView style={styles.centerContent}>
            <ThemedText>Loading...</ThemedText>
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
          <ThemedText style={styles.headerTitle}>Followers</ThemedText>
          <View style={{ width: 40 }} />
        </ThemedView>

        {/* Followers Counter */}
        <ThemedView style={styles.counterContainer}>
          <ThemedText style={styles.counterText}>
            {followerCount} {followerCount === 1 ? 'follower' : 'followers'}
          </ThemedText>
        </ThemedView>

        {/* Content */}
        <ThemedView style={styles.content}>
          {followers.length === 0 ? (
            renderEmptyState()
          ) : (
            <FlatList
              data={followers}
              renderItem={renderFollowerItem}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.followersList}
              refreshing={refreshing}
              onRefresh={handleRefresh}
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
  followersList: {
    paddingTop: 16,
    paddingBottom: 20,
  },
  followerItem: {
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
  followerContent: {
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
  followerText: {
    marginLeft: 12,
    flex: 1,
  },
  followerName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  followerSubtitle: {
    fontSize: 14,
    color: '#666',
  },
});