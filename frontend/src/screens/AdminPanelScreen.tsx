import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, ActivityIndicator, Alert } from 'react-native';
import { colors, fonts } from '../theme';
import apiClient from '../api/client';
import { useAuthStore } from '../store/useAuthStore';

interface UserItem {
  id: number;
  email: string;
  full_name: string;
  is_active: boolean;
  is_superuser: boolean;
}

export default function AdminPanelScreen() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const token = useAuthStore(state => state.token);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      // Assuming GET /users/ requires superuser token
      // Replace with actual admin endpoint when available
      // const res = await apiClient.get('/users/', { headers: { Authorization: `Bearer ${token}` }});
      
      // Simulating API response
      setTimeout(() => {
        setUsers([
          { id: 1, email: 'admin@test.com', full_name: 'Admin', is_active: true, is_superuser: true },
          { id: 2, email: 'user1@test.com', full_name: 'User 1', is_active: true, is_superuser: false },
          { id: 3, email: 'user2@test.com', full_name: 'User 2', is_active: false, is_superuser: false },
        ]);
        setLoading(false);
      }, 1500);

    } catch (error: any) {
      console.log('Error fetching users', error);
      Alert.alert('Lỗi', 'Không thể tải danh sách người dùng. Bạn có phải Admin không?');
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: UserItem }) => {
    return (
      <View style={styles.card}>
        <View style={styles.cardInfo}>
          <Text style={styles.userName}>{item.full_name}</Text>
          <Text style={styles.userEmail}>{item.email}</Text>
        </View>
        <View style={styles.cardBadges}>
          {item.is_superuser && <View style={[styles.badge, styles.adminBadge]}><Text style={styles.badgeText}>Admin</Text></View>}
          <View style={[styles.badge, item.is_active ? styles.activeBadge : styles.inactiveBadge]}>
            <Text style={styles.badgeText}>{item.is_active ? 'Active' : 'Inactive'}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Quản trị hệ thống (Admin Panel)</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={item => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
  },
  header: {
    padding: 16,
    backgroundColor: colors.surfaceLight,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    alignItems: 'center',
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.primary,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    padding: 16,
  },
  card: {
    backgroundColor: colors.surfaceLight,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  cardInfo: {
    flex: 1,
  },
  userName: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.textLight,
  },
  userEmail: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textMutedLight,
    marginTop: 4,
  },
  cardBadges: {
    alignItems: 'flex-end',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 4,
  },
  badgeText: {
    fontFamily: fonts.semiBold,
    fontSize: 10,
    color: '#FFF',
  },
  adminBadge: {
    backgroundColor: colors.primary,
  },
  activeBadge: {
    backgroundColor: colors.secondary,
  },
  inactiveBadge: {
    backgroundColor: colors.error,
  }
});
