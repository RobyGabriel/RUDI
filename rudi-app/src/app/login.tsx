// ============================================================
// src/app/login.tsx
// ------------------------------------------------------------
// Ecranul de autentificare.
// Concepte folosite:
//   - useState: variabile locale ale ecranului (email, parolă, eroare)
//   - async/await: așteptăm răspunsul de la server
//   - router.replace: navigăm fără să lăsăm login-ul în istoric
// ============================================================

import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { mockAuth } from '../lib/supabase';
import { useRobotStore } from '../store/useRobotStore';

export default function LoginScreen() {
  const router = useRouter();
  const setCurrentUser = useRobotStore((s) => s.setCurrentUser);

  // useState = variabilă locală care, când se schimbă, re-randează ecranul
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    // Validare simplă
    if (!email || !password) {
      setError('Completează emailul și parola.');
      return;
    }

    setLoading(true);  // Afișăm spinner
    setError(null);    // Ștergem eroarea anterioară

    // Apelăm funcția de login (simulată sau reală)
    const { user, error: authError } = await mockAuth.signIn(email, password);

    setLoading(false);

    if (authError || !user) {
      setError(authError ?? 'Eroare necunoscută.');
      return;
    }

    // Login reușit — salvăm utilizatorul în store și navigăm la home
    setCurrentUser(user);
    router.replace('/(tabs)');
  };

  return (
    // KeyboardAvoidingView: ridică conținutul deasupra tastaturii pe iOS
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Logo și titlu */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <Text style={styles.logoText}>R</Text>
        </View>
        <Text style={styles.title}>RUDI</Text>
        <Text style={styles.subtitle}>Robot Curier Inteligent</Text>
      </View>

      {/* Card cu formularul de login */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Intră în cont</Text>

        {/* Câmp email */}
        <View style={styles.inputWrapper}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}          // actualizăm starea la fiecare tastă
            placeholder="exemplu@thecon.ro"
            placeholderTextColor="#475569"
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>

        {/* Câmp parolă */}
        <View style={styles.inputWrapper}>
          <Text style={styles.label}>Parolă</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor="#475569"
            secureTextEntry          // ascunde caracterele parolei
          />
        </View>

        {/* Mesaj de eroare (vizibil doar dacă există) */}
        {error && <Text style={styles.error}>{error}</Text>}

        {/* Buton login */}
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />     // spinner în timp ce așteptăm
            : <Text style={styles.buttonText}>Intră în cont</Text>
          }
        </TouchableOpacity>
      </View>

      <Text style={styles.footer}>Contul îl creează administratorul firmei.</Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0F1A',
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoText: {
    fontSize: 36,
    fontWeight: '800',
    color: '#fff',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
    letterSpacing: 1,
  },
  card: {
    backgroundColor: '#161929',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 24,
  },
  inputWrapper: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 8,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#0D0F1A',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 14,
    color: '#F8FAFC',
    fontSize: 16,
  },
  error: {
    color: '#EF4444',
    fontSize: 13,
    marginBottom: 12,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#6366F1',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    color: '#475569',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 24,
  },
});
