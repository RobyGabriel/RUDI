// ============================================================
// src/app/(tabs)/profile.tsx — Ecranul de Setări / Profil
// ============================================================

import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { mockAuth } from '../../lib/supabase';
import { useRobotStore } from '../../store/useRobotStore';

export default function ProfileScreen() {
  const router = useRouter();
  const { currentUser, setCurrentUser } = useRobotStore();

  const handleLogout = async () => {
    await mockAuth.signOut();
    setCurrentUser(null);
    router.replace('/login');
  };

  // Inițialele numelui pentru avatar
  const initials = currentUser?.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase() ?? '?';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* Avatar cu inițiale */}
      <View style={styles.avatarContainer}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.name}>{currentUser?.name}</Text>
        <Text style={styles.office}>{currentUser?.office}</Text>
        {currentUser?.role === 'admin' && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>🛡️ Administrator</Text>
          </View>
        )}
      </View>

      {/* Detalii cont */}
      <View style={styles.card}>
        <Row label="Email" value={currentUser?.email ?? '—'} />
        <Row label="Birou" value={currentUser?.office ?? '—'} />
        <Row label="Rol" value={currentUser?.role === 'admin' ? 'Administrator' : 'Angajat'} />
      </View>

      {/* Administrare (doar pentru admini) */}
      {currentUser?.role === 'admin' && (
        <TouchableOpacity style={styles.adminButton} onPress={() => router.push('/admin/users' as any)}>
          <Text style={styles.adminButtonText}>⚙️  Gestiune Angajați</Text>
        </TouchableOpacity>
      )}

      {/* Delogare */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Deconectare</Text>
      </TouchableOpacity>

    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0F1A' },
  content: { padding: 24, paddingTop: 60, paddingBottom: 40 },
  avatarContainer: { alignItems: 'center', marginBottom: 32 },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#6366F1', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  avatarText: { fontSize: 32, fontWeight: '800', color: '#fff' },
  name: { fontSize: 24, fontWeight: '800', color: '#F8FAFC' },
  office: { fontSize: 14, color: '#6366F1', marginTop: 4, fontWeight: '600' },
  card: { backgroundColor: '#161929', borderRadius: 16, padding: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginBottom: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  rowLabel: { color: '#64748B', fontSize: 14 },
  rowValue: { color: '#F8FAFC', fontSize: 14, fontWeight: '600' },
  badge: { marginTop: 8, backgroundColor: 'rgba(99,102,241,0.15)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 4 },
  badgeText: { color: '#818CF8', fontSize: 13, fontWeight: '600' },
  adminButton: { backgroundColor: 'rgba(99,102,241,0.15)', borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: 'rgba(99,102,241,0.4)' },
  adminButtonText: { color: '#818CF8', fontSize: 15, fontWeight: '700' },
  logoutButton: { backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#EF4444' },
  logoutText: { color: '#EF4444', fontSize: 15, fontWeight: '700' },
});
