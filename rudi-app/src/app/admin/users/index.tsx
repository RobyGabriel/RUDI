// ============================================================
// src/app/admin/users/index.tsx — Lista angajaților (Admin)
// ============================================================

import { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { mockEmployees, User } from '../../../lib/supabase';

export default function AdminUsersScreen() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const loadUsers = async () => {
    setLoading(true);
    const data = await mockEmployees.getAll();
    setUsers(data);
    setLoading(false);
  };

  useFocusEffect(
    useCallback(() => {
      loadUsers();
    }, [])
  );

  const handleDelete = (user: User) => {
    Alert.alert(
      'Șterge angajat',
      `Ești sigur că vrei să ștergi contul lui ${user.name}?`,
      [
        { text: 'Anulează', style: 'cancel' },
        {
          text: 'Șterge',
          style: 'destructive',
          onPress: async () => {
            await mockEmployees.delete(user.id);
            loadUsers(); // Reîncărcăm lista
          },
        },
      ]
    );
  };

  const renderUser = ({ item }: { item: User }) => {
    const initials = item.name.split(' ').map((w) => w[0]).join('').toUpperCase();
    return (
      <View style={styles.card}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.detail}>{item.email}</Text>
          <Text style={styles.office}>{item.office}</Text>
        </View>
        <View style={styles.actions}>
          <TouchableOpacity onPress={() => router.push(`/admin/users/${item.id}`)} style={styles.editBtn}>
            <Text style={styles.editBtnText}>✏️</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDelete(item)} style={styles.deleteBtn}>
            <Text style={styles.deleteBtnText}>🗑️</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {loading
        ? <ActivityIndicator color="#6366F1" size="large" style={{ marginTop: 60 }} />
        : (
          <FlatList
            data={users}
            keyExtractor={(item) => item.id}
            renderItem={renderUser}
            contentContainerStyle={{ gap: 10, padding: 16, paddingBottom: 100 }}
            ListEmptyComponent={<Text style={styles.empty}>Nu există angajați.</Text>}
          />
        )
      }

      {/* Buton flotant de adăugare */}
      <TouchableOpacity style={styles.fab} onPress={() => router.push('/admin/users/new')}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0F1A' },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#161929', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#6366F1', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontWeight: '700', color: '#fff' },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '700', color: '#F8FAFC' },
  detail: { fontSize: 12, color: '#64748B', marginTop: 2 },
  office: { fontSize: 12, color: '#6366F1', marginTop: 2, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 8 },
  editBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(99,102,241,0.15)', alignItems: 'center', justifyContent: 'center' },
  editBtnText: { fontSize: 16 },
  deleteBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(239,68,68,0.1)', alignItems: 'center', justifyContent: 'center' },
  deleteBtnText: { fontSize: 16 },
  empty: { color: '#64748B', textAlign: 'center', marginTop: 60, fontSize: 16 },
  fab: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: '#6366F1', alignItems: 'center', justifyContent: 'center', elevation: 8 },
  fabText: { fontSize: 28, color: '#fff', lineHeight: 32 },
});
