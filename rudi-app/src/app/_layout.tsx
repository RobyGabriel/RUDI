// ============================================================
// src/app/_layout.tsx
// ------------------------------------------------------------
// Layoutul rădăcină al aplicației.
// Rolul său: verifică la pornire dacă ești logat.
// Dacă NU → trimite la /login
// Dacă DA → lasă aplicația să funcționeze normal
// ============================================================

import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { mockAuth } from '../lib/supabase';
import { useRobotStore } from '../store/useRobotStore';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const { currentUser, setCurrentUser } = useRobotStore();
  const [isMounted, setIsMounted] = useState(false);

  // 1. Verificam starea initiala de login si marcam componenta ca fiind montata
  useEffect(() => {
    const user = mockAuth.getCurrentUser();
    if (user) {
      setCurrentUser(user);
    }
    setIsMounted(true);
  }, []);

  // 2. Navigam DOAR cand stack-ul principal s-a montat complet pe ecran
  useEffect(() => {
    if (!isMounted) return;

    const inAuthGroup = segments[0] === 'login';

    if (!currentUser && !inAuthGroup) {
      router.replace('/login');
    } else if (currentUser && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [currentUser, segments, isMounted]);

  return (
    <>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="send" options={{ title: 'Trimite robotul', headerStyle: { backgroundColor: '#0D0F1A' }, headerTintColor: '#F8FAFC' }} />
        <Stack.Screen name="confirm" options={{ headerShown: false }} />
        <Stack.Screen name="admin/users/index" options={{ title: 'Angajați', headerStyle: { backgroundColor: '#0D0F1A' }, headerTintColor: '#F8FAFC' }} />
        <Stack.Screen name="admin/users/new" options={{ title: 'Adaugă angajat', headerStyle: { backgroundColor: '#0D0F1A' }, headerTintColor: '#F8FAFC' }} />
        <Stack.Screen name="admin/users/[id]" options={{ title: 'Editează angajat', headerStyle: { backgroundColor: '#0D0F1A' }, headerTintColor: '#F8FAFC' }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>
      <StatusBar style="light" />
    </>
  );
}
