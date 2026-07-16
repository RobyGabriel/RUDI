import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { mockAuth } from '../lib/supabase';
import { useRobotStore } from '../store/useRobotStore';

import { SafeAreaProvider } from 'react-native-safe-area-context';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const { currentUser, setCurrentUser } = useRobotStore();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const user = mockAuth.getCurrentUser();
    if (user) {
      setCurrentUser(user);
    }
    setIsMounted(true);
  }, []);

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
    // 2. WRAP THE ENTIRE RETURN IN SafeAreaProvider
    <SafeAreaProvider>
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
    </SafeAreaProvider>
  );
}