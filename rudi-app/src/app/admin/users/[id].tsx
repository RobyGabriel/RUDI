// ============================================================
// src/app/admin/users/[id].tsx — Editează angajat (Admin)
// ============================================================

import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { apiFetch } from '../../../lib/api';

export default function AdminEditUserScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [stationId, setStationId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Încărcăm datele actuale ale angajatului
  useEffect(() => {
    if (typeof id === 'string') {
      apiFetch(`/employees/${id}`)
        .then((emp) => {
          setName(emp.name);
          setEmail(emp.email);
          setStationId(emp.station_id);
          setLoading(false);
        })
        .catch(() => {
          if (Platform.OS === 'web') {
            window.alert('Angajatul nu a fost găsit.');
            router.back();
          } else {
            Alert.alert('Eroare', 'Angajatul nu a fost găsit.');
            router.back();
          }
        });
    }
  }, [id]);

  const handleUpdate = async () => {
    if (!name || !email || !stationId) {
      if (Platform.OS === 'web') {
        window.alert('Toate câmpurile sunt obligatorii.');
      } else {
        Alert.alert('Eroare', 'Toate câmpurile sunt obligatorii.');
      }
      return;
    }

    setSaving(true);
    try {
      await apiFetch(`/employees/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ name, email, station_id: stationId }),
      });
      if (Platform.OS === 'web') {
        window.alert('Datele au fost salvate cu succes.');
        router.back();
      } else {
        Alert.alert('Succes', 'Datele au fost salvate cu succes.', [
          { text: 'OK', onPress: () => router.back() }
        ]);
      }
    } catch (err: any) {
      if (Platform.OS === 'web') {
        window.alert(err.message || 'Nu s-au putut actualiza datele.');
      } else {
        Alert.alert('Eroare', err.message || 'Nu s-au putut actualiza datele.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (typeof id !== 'string') return;

    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Ești sigur că vrei să resetezi parola acestui angajat la cea implicită (Pass123!)?');
      if (confirmed) {
        try {
          const res = await apiFetch(`/employees/${id}/reset-password`, { method: 'POST' });
          window.alert(`Succes: Parola a fost resetată la: ${res.default_password}`);
        } catch (err) {
          window.alert('Eroare: Nu s-a putut reseta parola.');
        }
      }
      return;
    }

    Alert.alert(
      'Resetare parolă',
      'Ești sigur că vrei să resetezi parola acestui angajat la cea implicită (Pass123!)?',
      [
        { text: 'Anulează', style: 'cancel' },
        {
          text: 'Resetează',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await apiFetch(`/employees/${id}/reset-password`, { method: 'POST' });
              Alert.alert('Succes', `Parola a fost resetată la: ${res.default_password}`);
            } catch (err) {
              Alert.alert('Eroare', 'Nu s-a putut reseta parola.');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center' }]}>
        <ActivityIndicator color="#6366F1" size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Editează datele</Text>
      <Text style={styles.subtitle}>Modifică datele de contact sau biroul acestui angajat.</Text>

      <View style={styles.card}>
        <View style={styles.inputWrapper}>
          <Text style={styles.label}>Nume complet</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Darius Popescu"
            placeholderTextColor="#475569"
          />
        </View>

        <View style={styles.inputWrapper}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="exemplu@thecon.ro"
            placeholderTextColor="#475569"
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>

        <View style={styles.inputWrapper}>
          <Text style={styles.label}>Stație / Birou</Text>
          <TextInput
            style={styles.input}
            value={stationId}
            onChangeText={setStationId}
            placeholder="Desk_12"
            placeholderTextColor="#475569"
          />
        </View>

        <TouchableOpacity
          style={[styles.button, saving && styles.buttonDisabled]}
          onPress={handleUpdate}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Salvează modificările</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.resetPwButton}
          onPress={handleResetPassword}
        >
          <Text style={styles.resetPwButtonText}>🔒 Resetează parola la &quot;Pass123!&quot;</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0F1A' },
  content: { padding: 24, paddingTop: 20 },
  title: { fontSize: 24, fontWeight: '800', color: '#F8FAFC', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#64748B', marginBottom: 24 },
  card: { backgroundColor: '#161929', borderRadius: 20, padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  inputWrapper: { marginBottom: 16 },
  label: { fontSize: 13, color: '#94A3B8', marginBottom: 8, fontWeight: '600' },
  input: { backgroundColor: '#0D0F1A', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 14, color: '#F8FAFC', fontSize: 16 },
  button: { backgroundColor: '#6366F1', borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 12 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  resetPwButton: { backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 12, borderWidth: 1, borderColor: '#EF4444' },
  resetPwButtonText: { color: '#EF4444', fontSize: 15, fontWeight: '700' },
});
