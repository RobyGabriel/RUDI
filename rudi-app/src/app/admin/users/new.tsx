// ============================================================
// src/app/admin/users/new.tsx — Adaugă angajat nou (Admin)
// ============================================================

import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { apiFetch } from '../../../lib/api';

export default function AdminNewUserScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [stationId, setStationId] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!name || !email || !stationId) {
      if (Platform.OS === 'web') {
        window.alert('Toate câmpurile sunt obligatorii.');
      } else {
        Alert.alert('Eroare', 'Toate câmpurile sunt obligatorii.');
      }
      return;
    }

    setLoading(true);
    try {
      await apiFetch('/employees', {
        method: 'POST',
        body: JSON.stringify({
          name,
          email,
          station_id: stationId,
          password: 'Pass123!',
          role: 'employee',
        }),
      });
      if (Platform.OS === 'web') {
        window.alert('Angajatul a fost creat cu succes.');
        router.back();
      } else {
        Alert.alert('Succes', 'Angajatul a fost creat cu succes.', [
          { text: 'OK', onPress: () => router.back() }
        ]);
      }
    } catch (err: any) {
      if (Platform.OS === 'web') {
        window.alert(err.message || 'Nu s-a putut salva utilizatorul.');
      } else {
        Alert.alert('Eroare', err.message || 'Nu s-a putut salva utilizatorul.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Angajat nou</Text>
      <Text style={styles.subtitle}>Creează un cont pentru un angajat nou din firmă.</Text>

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

        <View style={styles.infoBox}>
          <Text style={styles.infoBoxText}>ℹ️ Contul va fi creat cu parola standard: <Text style={styles.boldText}>Pass123!</Text></Text>
          <Text style={styles.infoBoxTextSmall}>Noul angajat o va putea schimba ulterior.</Text>
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Salvează contul</Text>
          )}
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
  infoBox: { backgroundColor: 'rgba(99,102,241,0.1)', padding: 14, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(99,102,241,0.2)' },
  infoBoxText: { color: '#818CF8', fontSize: 14, marginBottom: 4 },
  boldText: { fontWeight: '800', color: '#fff' },
  infoBoxTextSmall: { color: '#64748B', fontSize: 12 },
});
