// ============================================================
// src/app/(tabs)/index.tsx — Ecranul principal (Home)
// ------------------------------------------------------------
// Afișează statusul robotului și butonul de chemare.
// Suportă fluxul extins în doi pași: chemare -> sosire la expeditor -> trimitere.
// ============================================================

import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, Alert } from 'react-native';
import { connectWebSocket, disconnectWebSocket, sendCommand } from '../../services/websocket';
import { useRobotStore } from '../../store/useRobotStore';
import { useMapStore } from '../../store/useMapStore';
import { apiFetch } from '../../lib/api';

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
  const { robotStatus: status, currentUser, connectionStatus, currentDelivery, lastMessage } = useRobotStore();
  const { robotPose } = useMapStore();
  const isCallConfirmed = robotPose?.last_command_ack === 'call_robot';
  const isDeliveryConfirmed = robotPose?.last_command_ack === 'start_delivery';

  const [isProcessing, setIsProcessing] = useState(false);

  // Conexiunea WebSocket
  useEffect(() => {
    connectWebSocket(process.env.EXPO_PUBLIC_WS_URL!);
    return () => disconnectWebSocket();
  }, []);

  const statusConfig = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.idle;
  const isSender = currentDelivery?.from.id === currentUser?.id;
  const isRecipient = currentDelivery?.to?.id === currentUser?.id;

  // Când primim mesaj de la server că starea s-a schimbat, resetăm spinner-ul
  useEffect(() => {
    setIsProcessing(false);
  }, [status]);

  // Ascultăm erorile venite de la backend (ex: robot ocupat)
  useEffect(() => {
    if (lastMessage?.type === 'error') {
      Alert.alert('Eroare', String(lastMessage.message));
      setIsProcessing(false);
    }
  }, [lastMessage]);

  // Handler Chemare Robot (Pasul 1)
  const handleCallRobot = () => {
    if (!currentUser || isProcessing) return;
    setIsProcessing(true);
    const sent = sendCommand({ type: 'call_robot', sender_id: currentUser.id, sender: currentUser, status: 'coming_to_sender' });
    if (!sent) setIsProcessing(false);
  };

  // Handler Confirmare Sosire la Mine (Pasul 2)
  const handleConfirmArrival = () => {
    if (isProcessing) return;
    setIsProcessing(true);
    const sent = sendCommand({ type: 'robot_arrived_sender', status: 'arrived_at_sender' });
    if (!sent) setIsProcessing(false);
  };

  // Handler Confirmare Sosire la Destinatar (Pasul 4)
  const handleMarkArrived = () => {
    if (isProcessing) return;
    setIsProcessing(true);
    const sent = sendCommand({ type: 'robot_arrived_recipient', status: 'arrived' });
    if (!sent) setIsProcessing(false);
  };

  // Handler Oprire de Urgență
  const [isEmergencyStopped, setIsEmergencyStopped] = useState(false);

  const handleEmergencyStop = async () => {
    setIsEmergencyStopped(true);
    sendCommand({ type: 'emergency_stop', status: 'idle' });
    try {
      await apiFetch('/robot/command', {
        method: 'POST',
        body: JSON.stringify({ action: 'stop' }),
      });
    } catch (e) {
      console.error("Eroare la oprirea motorului:", e);
    }
    
    setTimeout(() => {
      setIsEmergencyStopped(false);
    }, 3000);
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

      {/* Buton de Oprire Urgență */}
      <TouchableOpacity 
        style={[styles.emergencyButton, isEmergencyStopped && styles.emergencyButtonActive]} 
        onPress={handleEmergencyStop} 
        activeOpacity={0.8}
        disabled={isEmergencyStopped}
      >
        <Text style={styles.emergencyIcon}>{isEmergencyStopped ? '⚠️' : '🛑'}</Text>
        <Text style={styles.emergencyText}>
          {isEmergencyStopped ? 'OPRIRE TRIMISĂ...' : 'OPRIRE DE URGENȚĂ'}
        </Text>
      </TouchableOpacity>

      {/* 1. Robotul este LIBER */}
      {status === 'idle' && (
        <TouchableOpacity 
          style={[styles.callButton, isProcessing && styles.buttonDisabled]} 
          onPress={handleCallRobot} 
          activeOpacity={0.8}
          disabled={isProcessing}
        >
          <Text style={styles.callButtonIcon}>🔔</Text>
          <Text style={styles.callButtonText}>{isProcessing ? "Se trimite..." : "Cheamă robotul"}</Text>
        </TouchableOpacity>
      )}

      {/* 2. Robotul VINE spre expeditor */}
      {status === 'coming_to_sender' && currentUser && (
        isSender ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Se deplasează spre tine</Text>
            <Text style={styles.ackText}>
              {isCallConfirmed ? '✅ Comandă confirmată de ESP32' : '⏳ Comandă trimisă. Se așteaptă confirmarea...'}
            </Text>
            <Text style={styles.statusDescription}>Robotul se îndreaptă către stația ta. Te rugăm să aștepți.</Text>
            <TouchableOpacity 
              style={[styles.confirmSenderButton, isProcessing && styles.buttonDisabled]} 
              onPress={handleConfirmArrival} 
              activeOpacity={0.8}
              disabled={isProcessing}
            >
              <Text style={styles.callButtonIcon}>📥</Text>
              <Text style={styles.callButtonText}>{isProcessing ? "Se confirmă..." : "Robotul a sosit (Încarcă foi)"}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.infoCard}>
            <Text style={styles.infoCardText}>Robotul este ocupat. Se deplasează către {currentDelivery?.from?.name || 'expeditor'}.</Text>
          </View>
        )
      )}

      {/* 3. Robotul A SOSIT la expeditor */}
      {status === 'arrived_at_sender' && (
        isSender ? (
          <TouchableOpacity style={styles.callButton} onPress={() => router.push('/send')} activeOpacity={0.8}>
            <Text style={styles.callButtonIcon}>🚀</Text>
            <Text style={styles.callButtonText}>Trimite (Selectează destinatar)</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.infoCard}>
            <Text style={styles.infoCardText}>Robotul este în curs de încărcare la {currentDelivery?.from?.name || 'expeditor'}.</Text>
          </View>
        )
      )}

      {/* 4. Robotul LIVREAZĂ (in_transit) */}
      {status === 'in_transit' && (
        isSender ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Livrare în curs</Text>
            <Text style={styles.ackText}>
              {isDeliveryConfirmed ? '✅ Comandă confirmată de ESP32' : '⏳ Comandă trimisă. Se așteaptă confirmarea...'}
            </Text>
            <Text style={styles.statusDescription}>Robotul se află în drum spre destinație.</Text>
          </View>
        ) : isRecipient ? (
          <TouchableOpacity 
            style={[styles.confirmSenderButton, isProcessing && styles.buttonDisabled]} 
            onPress={handleMarkArrived} 
            activeOpacity={0.8}
            disabled={isProcessing}
          >
            <Text style={styles.callButtonIcon}>📦</Text>
            <Text style={styles.callButtonText}>{isProcessing ? "Se confirmă..." : "Robotul a sosit la mine"}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.infoCard}>
            <Text style={styles.infoCardText}>Robotul livrează un pachet de la {currentDelivery?.from.name} pentru {currentDelivery?.to?.name}.</Text>
          </View>
        )
      )}

      {status === 'arrived' && (
        isRecipient ? (
          <TouchableOpacity style={styles.confirmRecipientButton} onPress={() => router.push('/confirm')} activeOpacity={0.8}>
            <Text style={styles.callButtonIcon}>✅</Text>
            <Text style={styles.callButtonText}>Preluare & Confirmare primire</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.infoCard}>
            <Text style={styles.infoCardText}>Se așteaptă confirmarea de primire de la {currentDelivery?.to?.name}.</Text>
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
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16, color: '#FFF' },
  emergencyButton: { backgroundColor: '#DC2626', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 16, marginBottom: 24 },
  emergencyButtonActive: { backgroundColor: '#7F1D1D' },
  emergencyIcon: { fontSize: 24, marginRight: 12 },
  emergencyText: { color: '#FFF', fontSize: 18, fontWeight: '800' },
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
  buttonDisabled: { opacity: 0.6 },
  infoCard: { backgroundColor: '#161929', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  infoCardText: { fontSize: 14, color: '#94A3B8', textAlign: 'center', lineHeight: 20 },
  ackText: { fontSize: 14, fontWeight: '600', color: '#818CF8', marginBottom: 12 },
  card: { backgroundColor: '#1E2235', borderRadius: 20, padding: 24, marginBottom: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
});