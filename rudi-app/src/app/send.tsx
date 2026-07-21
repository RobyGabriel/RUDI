// ============================================================
// src/app/send.tsx — Selectează destinatarul și trimite robotul
// ============================================================

import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { mockEmployees, User } from '../lib/apiClient';
import { useRobotStore } from '../store/useRobotStore';
import { sendCommand } from '../services/websocket';

export default function SendScreen() {
  const router = useRouter();
  const { currentUser, startDelivery } = useRobotStore();

  const [employees, setEmployees] = useState<User[]>([]);
  const [selected, setSelected] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Încărcăm lista de angajați când se deschide ecranul
  useEffect(() => {
    mockEmployees.getAll().then((data) => {
      // Nu arătăm utilizatorul curent în lista de destinatari
      setEmployees(data.filter((e) => e.id !== currentUser?.id));
      setLoading(false);
    });
  }, []);

  const handleSend = async () => {
    if (!selected || !currentUser) return;
    setSending(true);

    // Trimitem comanda prin WebSocket (codul colegului)
    sendCommand({
      type: 'start_delivery',
      from: currentUser.id,
      to: selected.id,
      from_user: currentUser,
      to_user: selected,
      status: 'in_transit',
    });

    // Actualizăm starea locală
    startDelivery(currentUser, selected);

    router.replace('/(tabs)');
  };

  const renderEmployee = ({ item }: { item: User }) => {
    const isSelected = selected?.id === item.id;
    const initials = item.name.split(' ').map((w) => w[0]).join('').toUpperCase();

    return (
      <TouchableOpacity
        style={[styles.employeeCard, isSelected && styles.employeeCardSelected]}
        onPress={() => setSelected(isSelected ? null : item)}
        activeOpacity={0.7}
      >
        <View style={[styles.employeeAvatar, isSelected && styles.employeeAvatarSelected]}>
          <Text style={styles.employeeInitials}>{initials}</Text>
        </View>
        <View style={styles.employeeInfo}>
          <Text style={styles.employeeName}>{item.name}</Text>
          <Text style={styles.employeeOffice}>{item.office}</Text>
        </View>
        {isSelected && <Text style={styles.checkmark}>✓</Text>}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Către cine trimiți foile?</Text>
      <Text style={styles.subtitle}>Selectează un destinatar din lista de mai jos.</Text>

      {loading ? (
        <ActivityIndicator color="#6366F1" size="large" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={employees}
          keyExtractor={(item) => item.id}
          renderItem={renderEmployee}
          style={styles.list}
          contentContainerStyle={{ gap: 10, paddingBottom: 120 }}
        />
      )}

      {/* Buton trimitere — apare fix în josul ecranului */}
      {selected && (
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Trimiți spre <Text style={{ color: '#F8FAFC', fontWeight: '700' }}>{selected.name}</Text>
          </Text>
          <TouchableOpacity
            style={[styles.sendButton, sending && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={sending}
          >
            {sending
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.sendButtonText}>🚀  Trimite robotul</Text>
            }
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0F1A', padding: 24, paddingTop: 20 },
  title: { fontSize: 24, fontWeight: '800', color: '#F8FAFC', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#64748B', marginBottom: 24 },
  list: { flex: 1 },
  employeeCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#161929', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', gap: 14 },
  employeeCardSelected: { borderColor: '#6366F1', backgroundColor: 'rgba(99,102,241,0.1)' },
  employeeAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#1E2235', alignItems: 'center', justifyContent: 'center' },
  employeeAvatarSelected: { backgroundColor: '#6366F1' },
  employeeInitials: { fontSize: 18, fontWeight: '700', color: '#F8FAFC' },
  employeeInfo: { flex: 1 },
  employeeName: { fontSize: 16, fontWeight: '700', color: '#F8FAFC' },
  employeeOffice: { fontSize: 13, color: '#64748B', marginTop: 2 },
  checkmark: { fontSize: 20, color: '#6366F1', fontWeight: '700' },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#161929', padding: 20, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  footerText: { fontSize: 14, color: '#64748B', marginBottom: 12, textAlign: 'center' },
  sendButton: { backgroundColor: '#6366F1', borderRadius: 14, padding: 16, alignItems: 'center' },
  sendButtonDisabled: { opacity: 0.6 },
  sendButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
