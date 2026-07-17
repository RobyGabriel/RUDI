// ============================================================
// src/app/(tabs)/profile.tsx — Ecranul de profil
// ============================================================

import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Alert, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { mockAuth } from '../../lib/supabase';
import { useRobotStore } from '../../store/useRobotStore';

export default function ProfileScreen() {
  const router = useRouter();
  const { currentUser, setCurrentUser } = useRobotStore();

  // State-uri pentru schimbarea parolei
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleLogout = async () => {
    await mockAuth.signOut();
    setCurrentUser(null);
    router.replace('/login');
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      Alert.alert('Eroare', 'Parola trebuie să aibă cel puțin 6 caractere.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Eroare', 'Parolele nu se potrivesc. Vă rugăm să reintroduceți cu atenție.');
      return;
    }

    if (!currentUser) return;

    setSaving(true);
    try {
      await mockAuth.changePassword(currentUser.id, newPassword);
      Alert.alert('Succes', 'Parola a fost modificată cu succes.');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordChange(false);
      setShowPassword(false);
    } catch (err) {
      Alert.alert('Eroare', 'Nu s-a putut schimba parola.');
    } finally {
      setSaving(false);
    }
  };

  // Inițialele numelui pentru avatar
  const initials = currentUser?.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase() ?? '?';

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
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

        {/* Secțiunea Schimbă Parola */}
        {showPasswordChange ? (
          <View style={styles.pwCard}>
            <Text style={styles.pwTitle}>Schimbă parola</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.inputWithIcon}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Noua parolă"
                placeholderTextColor="#475569"
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity 
                style={styles.eyeBtn} 
                onPress={() => setShowPassword(!showPassword)}
              >
                <Text style={styles.eyeIcon}>{showPassword ? '👁️‍🗨️' : '👁️'}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.inputWithIcon}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirmă parola"
                placeholderTextColor="#475569"
                secureTextEntry={!showPassword}
              />
            </View>
            <View style={styles.pwActions}>
              <TouchableOpacity 
                style={styles.cancelBtn} 
                onPress={() => { setShowPasswordChange(false); setNewPassword(''); setConfirmPassword(''); setShowPassword(false); }}
              >
                <Text style={styles.cancelBtnText}>Anulează</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.saveBtn} 
                onPress={handleChangePassword}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>Salvează</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={styles.changePwButton} onPress={() => setShowPasswordChange(true)}>
            <Text style={styles.changePwText}>🔒  Schimbă parola mea</Text>
          </TouchableOpacity>
        )}

        {/* Delogare */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Deconectare</Text>
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
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
  badge: { marginTop: 8, backgroundColor: 'rgba(99,102,241,0.15)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 4 },
  badgeText: { color: '#818CF8', fontSize: 13, fontWeight: '600' },
  card: { backgroundColor: '#161929', borderRadius: 16, padding: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginBottom: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  rowLabel: { color: '#64748B', fontSize: 14 },
  rowValue: { color: '#F8FAFC', fontSize: 14, fontWeight: '600' },
  
  // Stiluri schimbare parola
  changePwButton: { backgroundColor: '#161929', borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  changePwText: { color: '#94A3B8', fontSize: 15, fontWeight: '600' },
  pwCard: { backgroundColor: '#161929', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: 'rgba(99,102,241,0.2)', marginBottom: 16 },
  pwTitle: { fontSize: 15, fontWeight: '700', color: '#F8FAFC', marginBottom: 12 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0D0F1A', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12, marginBottom: 14 },
  inputWithIcon: { flex: 1, padding: 12, color: '#F8FAFC', fontSize: 15 },
  eyeBtn: { padding: 12 },
  eyeIcon: { fontSize: 16 },
  pwActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)' },
  cancelBtnText: { color: '#94A3B8', fontSize: 14, fontWeight: '600' },
  saveBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, backgroundColor: '#6366F1' },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  logoutButton: { backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#EF4444' },
  logoutText: { color: '#EF4444', fontSize: 15, fontWeight: '700' },
  
  adminButton: { backgroundColor: 'rgba(99,102,241,0.15)', borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: 'rgba(99,102,241,0.4)' },
  adminButtonText: { color: '#818CF8', fontSize: 15, fontWeight: '700' },
});
