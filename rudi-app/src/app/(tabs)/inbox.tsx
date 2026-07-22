// ============================================================
// src/app/(tabs)/inbox.tsx — Inbox-ul de Notificări
// ------------------------------------------------------------
// Afișează toate pachetele care vin spre tine sau care au fost
// livrate deja. Apăsarea unei notificări active te duce la ecranul
// de confirmare.
// ============================================================

import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useRobotStore, AppNotification } from '../../store/useRobotStore';

export default function InboxScreen() {
  const router = useRouter();
  const currentUser = useRobotStore((s) => s.currentUser);
  const notifications = useRobotStore((s) => s.notifications);
  const deleteNotification = useRobotStore((s) => s.deleteNotification);

  // Filtrăm notificările care mă implică (sunt expeditor sau destinatar)
  const myNotifications = notifications.filter(
    (n) => n.to.id === currentUser?.id || n.from.id === currentUser?.id
  );

  const handleNotificationPress = (notif: AppNotification) => {
    // Dacă pachetul e încă pe drum sau a sosit, mergem la confirmare
    if (notif.status === 'in_transit') {
      router.push('/confirm');
    }
  };

  const renderItem = ({ item }: { item: AppNotification }) => {
    const isActive = item.status === 'in_transit';
    const isSender = currentUser?.id === item.from.id;
    
    // Formatăm ora (ex: 14:35)
    const timeStr = new Date(item.timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    let titleText = '';
    let bodyText = '';

    if (isSender) {
      if (isActive) {
        titleText = 'Livrare în curs spre destinatar';
        bodyText = `Robotul transportă pachetul tău către ${item.to.name} (${item.to.office}).`;
      } else {
        titleText = 'Livrare finalizată cu succes';
        bodyText = `Angajatul ${item.to.name} a confirmat primirea pachetului trimis de tine.`;
      }
    } else {
      if (isActive) {
        titleText = 'Robotul vine spre tine';
        bodyText = `Angajatul ${item.from.name} ți-a trimis documente de la ${item.from.office}.`;
      } else {
        titleText = 'Pachet primit cu succes';
        bodyText = `Ai preluat foile trimise de ${item.from.name}.`;
      }
    }

    return (
      <TouchableOpacity
        style={[styles.card, isActive && styles.cardActive]}
        onPress={isActive && !isSender ? () => handleNotificationPress(item) : undefined}
        activeOpacity={isActive && !isSender ? 0.7 : 1}
      >
        <View style={styles.headerRow}>
          <Text style={styles.icon}>{isActive ? '🚀' : '📦'}</Text>
          <View style={styles.titleCol}>
            <Text style={styles.title}>{titleText}</Text>
            <Text style={styles.time}>{timeStr}</Text>
          </View>
        </View>

        <Text style={styles.body}>{bodyText}</Text>

        <View style={styles.footerRow}>
          <View style={[styles.badge, isActive ? styles.badgeActive : styles.badgeDone]}>
            <Text style={[styles.badgeText, isActive ? styles.badgeTextActive : styles.badgeTextDone]}>
              {isActive ? 'În mișcare' : 'Livrat'}
            </Text>
          </View>

          {isActive ? (
            <Text style={styles.actionLink}>Confirmă primirea →</Text>
          ) : (
            <TouchableOpacity onPress={() => deleteNotification(item.id)} hitSlop={{top:10, bottom:10, left:10, right:10}}>
              <Text style={styles.deleteBadgeText}>Șterge ✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.mainTitle}>Inbox Alerte</Text>
        <Text style={styles.subtitle}>Urmărește statusul livrărilor tale de la robot.</Text>
      </View>

      <FlatList
        data={myNotifications}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🔔</Text>
            <Text style={styles.emptyTitle}>Inbox gol</Text>
            <Text style={styles.emptySubtitle}>
              Momentan nu ai nicio notificare de livrare activă sau trecută.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0F1A', paddingTop: 60 },
  header: { paddingHorizontal: 20, marginBottom: 20 },
  mainTitle: { fontSize: 24, fontWeight: '800', color: '#F8FAFC' },
  subtitle: { fontSize: 13, color: '#64748B', marginTop: 4 },
  listContent: { gap: 12, paddingHorizontal: 20, paddingBottom: 40 },
  
  card: {
    backgroundColor: '#161929',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  cardActive: {
    borderColor: '#6366F1',
    backgroundColor: 'rgba(99,102,241,0.05)',
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  icon: { fontSize: 24 },
  titleCol: { flex: 1 },
  title: { fontSize: 15, fontWeight: '700', color: '#F8FAFC' },
  time: { fontSize: 11, color: '#475569', marginTop: 2 },
  body: { fontSize: 13, color: '#94A3B8', lineHeight: 18, marginBottom: 14 },
  
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeActive: { backgroundColor: 'rgba(245,158,11,0.15)' },
  badgeDone: { backgroundColor: 'rgba(34,197,94,0.15)' },
  badgeText: { fontSize: 11, fontWeight: '700' },
  badgeTextActive: { color: '#F59E0B' },
  badgeTextDone: { color: '#22C55E' },
  
  actionLink: { fontSize: 13, color: '#818CF8', fontWeight: '700' },
  deleteBadgeText: { fontSize: 13, color: '#EF4444', fontWeight: '600' },
  
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 80, paddingHorizontal: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 16, opacity: 0.3 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#64748B', marginBottom: 6 },
  emptySubtitle: { fontSize: 13, color: '#475569', textAlign: 'center', lineHeight: 18 },
});
