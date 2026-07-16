// ============================================================
// src/app/(tabs)/index.tsx — Ecranul principal (Home)
// ------------------------------------------------------------
// Afișează statusul robotului și butonul de chemare.
// Suportă fluxul extins în doi pași: chemare -> sosire la expeditor -> trimitere.
// ============================================================

import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { connectWebSocket, sendCommand } from '../../services/websocket';
import { useRobotStore } from '../../store/useRobotStore';

// Configurația vizuală pentru fiecare stare a robotului
const STATUS_CONFIG = {
  idle: {
    icon: '🤖',
    label: 'Liber',
    description: 'Robotul este disponibil și poate fi chemat.',
    color: '#22C55E',
    bg: 'rgba(34,197,94,0.1)',
  },
  coming_to_sender: {
    icon: '🏃‍♂️',
    label: 'Vine spre expeditor',
    description: 'Robotul se deplasează spre biroul expeditorului.',
    color: '#F59E0B',
    bg: 'rgba(245,158,11,0.1)',
  },
  arrived_at_sender: {
    icon: '📥',
    label: 'A sosit la expeditor',
    description: 'Robotul a ajuns la tine. Te rugăm să încarci foile și să selectezi destinatarul.',
    color: '#6366F1',
    bg: 'rgba(99,102,241,0.1)',
  },
  in_transit: {
    icon: '🚀',
    label: 'În misiune',
    description: 'Robotul transportă documentele spre destinatar.',
    color: '#F59E0B',
    bg: 'rgba(245,158,11,0.1)',
  },
  arrived: {
    icon: '📦',
    label: 'A ajuns la destinatar',
    description: 'Robotul a sosit la destinatar. Se așteaptă confirmarea de primire.',
    color: '#22C55E',
    bg: 'rgba(34,197,94,0.1)',
  },
};

export default function HomeScreen() {
  const router = useRouter();

  // Citim datele din Zustand
  const connectionStatus = useRobotStore((s) => s.connectionStatus);
  const robotStatus = useRobotStore((s) => s.robotStatus);
  const currentDelivery = useRobotStore((s) => s.currentDelivery);
  const currentUser = useRobotStore((s) => s.currentUser);
  const callRobot = useRobotStore((s) => s.callRobot);
  const confirmArrivalAtSender = useRobotStore((s) => s.confirmArrivalAtSender);
  const markArrived = useRobotStore((s) => s.markArrived);

  // Conexiunea WebSocket (neatinsă)
  useEffect(() => {
    const ws = connectWebSocket(process.env.EXPO_PUBLIC_WS_URL!);
    return () => ws.close();
  }, []);

  const statusConfig = STATUS_CONFIG[robotStatus] ?? STATUS_CONFIG.idle;
  const isSender = currentDelivery?.from.id === currentUser?.id;
  const isRecipient = currentDelivery?.to?.id === currentUser?.id;

  // Handler Chemare Robot (Pasul 1)
  const handleCallRobot = () => {
    if (!currentUser) return;
    // Trimitem prin WebSocket
    sendCommand({ type: 'call_robot', sender_id: currentUser.id, sender: currentUser, status: 'coming_to_sender' });
    // Schimbăm starea în store local
    callRobot(currentUser);
  };

  // Handler Confirmare Sosire la Mine (Pasul 2)
  const handleConfirmArrival = () => {
    sendCommand({ type: 'robot_arrived_sender', status: 'arrived_at_sender' });
    confirmArrivalAtSender();
  };

  // Handler Confirmare Sosire la Destinatar (Pasul 4)
  const handleMarkArrived = () => {
    sendCommand({ type: 'robot_arrived_recipient', status: 'arrived' });
    markArrived();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.greeting}>Bună ziua,</Text>
        <Text style={styles.userName}>{currentUser?.name ?? '—'}</Text>
        <Text style={styles.userOffice}>{currentUser?.office ?? ''}</Text>
      </View>

      {/* Status conexiune */}
      <View style={[styles.wsCard, { borderColor: connectionStatus === 'connected' ? '#22C55E' : '#EF4444' }]}>
        <Text style={styles.wsIcon}>{connectionStatus === 'connected' ? '🟢' : '🔴'}</Text>
        <Text style={styles.wsText}>
          Server: {connectionStatus === 'connected' ? 'Conectat' : connectionStatus}
        </Text>
      </View>

      {/* Card principal status robot */}
      <View style={[styles.statusCard, { backgroundColor: statusConfig.bg, borderColor: statusConfig.color }]}>
        <Text style={styles.statusIcon}>{statusConfig.icon}</Text>
        <Text style={[styles.statusLabel, { color: statusConfig.color }]}>{statusConfig.label}</Text>
        <Text style={styles.statusDescription}>{statusConfig.description}</Text>

        {/* Detalii cursă activă */}
        {currentDelivery && (
          <View style={styles.deliveryInfo}>
            <Text style={styles.deliveryText}>
              Expeditor: <Text style={styles.deliveryName}>{currentDelivery.from.name} ({currentDelivery.from.office})</Text>
            </Text>
            {currentDelivery.to && (
              <Text style={styles.deliveryText}>
                Destinatar: <Text style={styles.deliveryName}>{currentDelivery.to.name} ({currentDelivery.to.office})</Text>
              </Text>
            )}
          </View>
        )}
      </View>

      {/* INTERFAȚĂ DINAMICĂ ÎN FUNCȚIE DE STATUS ȘI ROL */}

      {/* 1. Robotul este LIBER */}
      {robotStatus === 'idle' && (
        <TouchableOpacity style={styles.callButton} onPress={handleCallRobot} activeOpacity={0.8}>
          <Text style={styles.callButtonIcon}>🔔</Text>
          <Text style={styles.callButtonText}>Cheamă robotul</Text>
        </TouchableOpacity>
      )}

      {/* 2. Robotul VINE spre expeditor */}
      {robotStatus === 'coming_to_sender' && (
        isSender ? (
          <TouchableOpacity style={styles.confirmSenderButton} onPress={handleConfirmArrival} activeOpacity={0.8}>
            <Text style={styles.callButtonIcon}>📥</Text>
            <Text style={styles.callButtonText}>Robotul a sosit (Încarcă foi)</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.infoCard}>
            <Text style={styles.infoCardText}>
              Robotul se deplasează spre {currentDelivery?.from.name} ({currentDelivery?.from.office}).
            </Text>
          </View>
        )
      )}

      {/* 3. Robotul A SOSIT la expeditor (așteaptă alegerea destinatarului) */}
      {robotStatus === 'arrived_at_sender' && (
        isSender ? (
          <TouchableOpacity style={styles.callButton} onPress={() => router.push('/send')} activeOpacity={0.8}>
            <Text style={styles.callButtonIcon}>🚀</Text>
            <Text style={styles.callButtonText}>Trimite (Selectează destinatar)</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.infoCard}>
            <Text style={styles.infoCardText}>
              Robotul este în curs de încărcare la {currentDelivery?.from.name}.
            </Text>
          </View>
        )
      )}

      {/* 4. Robotul este pe drum (IN TRANSIT) spre destinatar */}
      {robotStatus === 'in_transit' && (
        isRecipient ? (
          <TouchableOpacity style={styles.confirmSenderButton} onPress={handleMarkArrived} activeOpacity={0.8}>
            <Text style={styles.callButtonIcon}>📦</Text>
            <Text style={styles.callButtonText}>Robotul a sosit la mine</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.infoCard}>
            <Text style={styles.infoCardText}>
              Robotul transportă foi către {currentDelivery?.to?.name} ({currentDelivery?.to?.office}).
            </Text>
          </View>
        )
      )}

      {/* 5. Robotul a sosit la destinatar (ARRIVED) */}
      {robotStatus === 'arrived' && (
        isRecipient ? (
          <TouchableOpacity style={styles.confirmRecipientButton} onPress={() => router.push('/confirm')} activeOpacity={0.8}>
            <Text style={styles.callButtonIcon}>✅</Text>
            <Text style={styles.callButtonText}>Preluare & Confirmare primire</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.infoCard}>
            <Text style={styles.infoCardText}>
              Se așteaptă confirmarea de primire de la {currentDelivery?.to?.name}.
            </Text>
          </View>
        )
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0F1A' },
  content: { padding: 24, paddingTop: 60, paddingBottom: 40 },

  header: { marginBottom: 24 },
  greeting: { fontSize: 16, color: '#64748B' },
  userName: { fontSize: 28, fontWeight: '800', color: '#F8FAFC', marginTop: 2 },
  userOffice: { fontSize: 14, color: '#6366F1', marginTop: 4, fontWeight: '600' },

  wsCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#161929', borderRadius: 12, padding: 12, borderWidth: 1, marginBottom: 20, gap: 8 },
  wsIcon: { fontSize: 14 },
  wsText: { fontSize: 13, color: '#94A3B8' },

  statusCard: { borderRadius: 20, padding: 28, alignItems: 'center', borderWidth: 1, marginBottom: 24 },
  statusIcon: { fontSize: 56, marginBottom: 12 },
  statusLabel: { fontSize: 22, fontWeight: '800', marginBottom: 8 },
  statusDescription: { fontSize: 13, color: '#94A3B8', textAlign: 'center', lineHeight: 18 },

  deliveryInfo: { marginTop: 16, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 12, padding: 14, width: '100%', gap: 6 },
  deliveryText: { fontSize: 13, color: '#94A3B8' },
  deliveryName: { color: '#F8FAFC', fontWeight: '700' },

  callButton: { backgroundColor: '#6366F1', borderRadius: 16, padding: 18, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 10 },
  confirmSenderButton: { backgroundColor: '#F59E0B', borderRadius: 16, padding: 18, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 10 },
  confirmRecipientButton: { backgroundColor: '#22C55E', borderRadius: 16, padding: 18, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 10 },
  callButtonText: { fontSize: 17, fontWeight: '700', color: '#fff' },
  callButtonIcon: { fontSize: 20 },

  infoCard: { backgroundColor: '#161929', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  infoCardText: { fontSize: 14, color: '#94A3B8', textAlign: 'center', lineHeight: 20 },
});