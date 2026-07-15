// ============================================================
// src/app/confirm.tsx — Destinatarul confirmă că a primit foile
// ============================================================

import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useRobotStore } from '../store/useRobotStore';
import { sendCommand } from '../services/websocket';

export default function ConfirmScreen() {
  const router = useRouter();
  const { currentDelivery, confirmDelivery } = useRobotStore();

  const handleConfirm = () => {
    // Trimitem confirmarea prin WebSocket
    sendCommand({ type: 'delivery_confirmed', status: 'delivered' });

    // Resetăm starea robotului în store
    confirmDelivery();

    // Mergem înapoi la home
    router.replace('/(tabs)');
  };

  return (
    <View style={styles.container}>

      {/* Animatie vizuala simpla */}
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>📦</Text>
      </View>

      <Text style={styles.title}>Robotul a ajuns!</Text>
      <Text style={styles.subtitle}>
        Foile tale au sosit de la{' '}
        <Text style={styles.highlight}>{currentDelivery?.from.name ?? '—'}</Text>
      </Text>

      {/* Detalii livrare */}
      <View style={styles.card}>
        <DetailRow label="De la" value={currentDelivery?.from?.name ?? '—'} />
        <DetailRow label="Birou expeditor" value={currentDelivery?.from?.office ?? '—'} />
        <DetailRow label="Către" value={currentDelivery?.to?.name ?? '—'} />
        <DetailRow label="Birou destinatar" value={currentDelivery?.to?.office ?? '—'} />
      </View>

      <Text style={styles.instruction}>
        Ridică foile din robot și apasă butonul de mai jos pentru a confirma primirea.
      </Text>

      {/* Buton mare de confirmare */}
      <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm} activeOpacity={0.8}>
        <Text style={styles.confirmButtonText}>✅  Am primit foile</Text>
      </TouchableOpacity>

    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0F1A', padding: 24, paddingTop: 60, alignItems: 'center' },
  iconContainer: { width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(99,102,241,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  icon: { fontSize: 56 },
  title: { fontSize: 28, fontWeight: '800', color: '#F8FAFC', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#64748B', textAlign: 'center', marginBottom: 32 },
  highlight: { color: '#6366F1', fontWeight: '700' },
  card: { backgroundColor: '#161929', borderRadius: 16, padding: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginBottom: 24, width: '100%' },
  row: { flexDirection: 'row', justifyContent: 'space-between', padding: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  rowLabel: { color: '#64748B', fontSize: 14 },
  rowValue: { color: '#F8FAFC', fontSize: 14, fontWeight: '600' },
  instruction: { fontSize: 14, color: '#475569', textAlign: 'center', marginBottom: 32, lineHeight: 22 },
  confirmButton: { backgroundColor: '#22C55E', borderRadius: 16, padding: 20, alignItems: 'center', width: '100%' },
  confirmButtonText: { color: '#fff', fontSize: 18, fontWeight: '800' },
});
