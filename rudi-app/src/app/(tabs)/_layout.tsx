import { Tabs, useRouter } from 'expo-router';
import { useRobotStore } from '../../store/useRobotStore';
import { Text, View } from 'react-native';

// Componentă simplă pentru iconul unui tab (text emoji)
function TabIcon({ icon, focused }: { icon: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>{icon}</Text>
  );
}

export default function TabLayout() {
  const currentUser = useRobotStore((s) => s.currentUser);
  const notifications = useRobotStore((s) => s.notifications);

  // Calculăm numărul de notificări active (care nu au fost încă livrate) pentru utilizatorul curent
  const activeCount = notifications.filter(
    (n) => n.to.id === currentUser?.id && n.status === 'in_transit'
  ).length;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#161929',
          borderTopColor: 'rgba(255,255,255,0.08)',
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: '#6366F1',
        tabBarInactiveTintColor: '#475569',
      }}
    >
      {/* 1. Tab Home — vizibil pentru toți */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Acasă',
          tabBarIcon: ({ focused }) => <TabIcon icon="🏠" focused={focused} />,
        }}
      />

      {/* 2. Tab Hartă — Aici controlăm tab-ul map.tsx */}
      <Tabs.Screen
        name="map"
        options={{
          title: 'Hartă',
          tabBarIcon: ({ focused }) => <TabIcon icon="🗺️" focused={focused} />,
        }}
      />

      {/* 3. Tab Inbox — vizibil pentru toți */}
      <Tabs.Screen
        name="inbox"
        options={{
          title: 'Inbox',
          tabBarIcon: ({ focused }) => <TabIcon icon="🔔" focused={focused} />,
          // Afișăm bulina roșie cu numărul de notificări active dacă acesta este > 0
          tabBarBadge: activeCount > 0 ? activeCount : undefined,
        }}
      />

      {/* 4. Tab Setări / Profil */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Setări',
          tabBarIcon: ({ focused }) => <TabIcon icon="⚙️" focused={focused} />,
        }}
      />

      {/* Ascundem explore (ecranul vechi) */}
      <Tabs.Screen
        name="explore"
        options={{ href: null }}
      />
    </Tabs>
  );
}