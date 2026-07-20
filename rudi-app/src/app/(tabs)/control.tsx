// ============================================================
// src/app/(tabs)/control.tsx — Tab Testare Comenzi Robot
// Comenzile corespund exact caracterelor din codul ESP32 C++
// ============================================================

import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { sendCommand } from '../../services/websocket';
import { useRobotStore } from '../../store/useRobotStore';
import { useMapStore } from '../../store/useMapStore';

type LogEntry = {
  id: number;
  text: string;
  time: string;
  type: 'sent' | 'ack' | 'error';
};

let logId = 0;

type RobotOnlineStatus = 'waiting' | 'online' | 'offline';

export default function ControlScreen() {
  const { connectionStatus } = useRobotStore();
  const { robotPose } = useMapStore();
  const [log, setLog] = useState<LogEntry[]>([]);
  const [activeBtn, setActiveBtn] = useState<string | null>(null);
  const [robotStatus, setRobotStatus] = useState<RobotOnlineStatus>('waiting');

  useEffect(() => {
    const check = () => {
      if (!robotPose.last_updated) { setRobotStatus('waiting'); return; }
      const age = Date.now() - new Date(robotPose.last_updated).getTime();
      setRobotStatus(age > 8000 ? 'offline' : 'online');
    };
    check();
    const interval = setInterval(check, 2000);
    return () => clearInterval(interval);
  }, [robotPose.last_updated]);

  const addLog = (text: string, type: LogEntry['type'] = 'sent') => {
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
    setLog((prev) => [{ id: logId++, text, time, type }, ...prev].slice(0, 40));
  };

  const send = (wsType: string, label: string, espChar: string) => {
    setActiveBtn(wsType);
    setTimeout(() => setActiveBtn(null), 400);
    sendCommand({ type: wsType });
    addLog(`▶ ${label}  →  ESP32: '${espChar}'`, 'sent');
  };

  const robotStatusConfig = {
    waiting: { dot: '#F59E0B', text: 'Așteptând date robot...' },
    online:  { dot: '#22C55E', text: 'Robot Online' },
    offline: { dot: '#EF4444', text: 'Robot Offline' },
  }[robotStatus];

  const serverConnected = connectionStatus === 'connected';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🎮 Control Robot</Text>
        <View style={styles.statusCol}>
          <View style={styles.statusRow}>
            <View style={[styles.dot, { backgroundColor: robotStatusConfig.dot }]} />
            <Text style={styles.statusText}>{robotStatusConfig.text}</Text>
          </View>
          <View style={styles.statusRow}>
            <View style={[styles.dot, { backgroundColor: serverConnected ? '#6366F1' : '#475569' }]} />
            <Text style={styles.statusSubText}>Server: {serverConnected ? 'Conectat' : connectionStatus}</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Stop Urgență — primul și cel mai mare */}
        <TouchableOpacity
          style={[styles.stopBtn, activeBtn === 'emergency_stop' && styles.stopBtnActive]}
          onPress={() => send('emergency_stop', 'Stop Urgență', 'X')}
          activeOpacity={0.8}
          disabled={activeBtn === 'emergency_stop'}
        >
          <Text style={styles.stopIcon}>🛑</Text>
          <Text style={styles.stopLabel}>STOP URGENȚĂ</Text>
          <Text style={styles.stopSub}>Trimite 'X' → stopMotors()</Text>
        </TouchableOpacity>

        {/* Test Complet */}
        <SectionTitle title="Test Secvență Completă" />
        <View style={styles.row}>
          <CmdBtn
            icon="🔄"
            label="Test Motoare"
            sub="'T' → ambele motoare"
            color="#6366F1"
            active={activeBtn === 'test_motors'}
            onPress={() => send('test_motors', 'Test Motoare', 'T')}
          />
        </View>

        {/* Motor 1 */}
        <SectionTitle title="Motor 1" />
        <View style={styles.row}>
          <CmdBtn
            icon="⬆️"
            label="M1 Înainte"
            sub="'F' → 99%, 10s"
            color="#22C55E"
            active={activeBtn === 'motor1_forward'}
            onPress={() => send('motor1_forward', 'M1 Înainte', 'F')}
          />
          <CmdBtn
            icon="⬇️"
            label="M1 Înapoi"
            sub="'B' → 99%, 10s"
            color="#F59E0B"
            active={activeBtn === 'motor1_backward'}
            onPress={() => send('motor1_backward', 'M1 Înapoi', 'B')}
          />
        </View>
        <View style={styles.row}>
          <CmdBtn
            icon="🔁"
            label="M1 Reverse Test"
            sub="'R' → 99%, 2s"
            color="#818CF8"
            active={activeBtn === 'motor1_reverse'}
            onPress={() => send('motor1_reverse', 'M1 Reverse', 'R')}
          />
          <CmdBtn
            icon="🔬"
            label="M1 Diagnostic"
            sub="'1' → 45%, 3s fwd+bwd"
            color="#94A3B8"
            active={activeBtn === 'motor1_diag'}
            onPress={() => send('motor1_diag', 'M1 Diagnostic', '1')}
          />
        </View>

        {/* Motor 2 */}
        <SectionTitle title="Motor 2" />
        <View style={styles.row}>
          <CmdBtn
            icon="⬆️"
            label="M2 Înainte"
            sub="'3' → 99%, 10s"
            color="#22C55E"
            active={activeBtn === 'motor2_forward'}
            onPress={() => send('motor2_forward', 'M2 Înainte', '3')}
          />
          <CmdBtn
            icon="⬇️"
            label="M2 Înapoi"
            sub="'4' → 99%, 10s"
            color="#F59E0B"
            active={activeBtn === 'motor2_backward'}
            onPress={() => send('motor2_backward', 'M2 Înapoi', '4')}
          />
        </View>
        <View style={styles.row}>
          <CmdBtn
            icon="🔬"
            label="M2 Diagnostic"
            sub="'2' → 45%, 3s fwd+bwd"
            color="#94A3B8"
            active={activeBtn === 'motor2_diag'}
            onPress={() => send('motor2_diag', 'M2 Diagnostic', '2')}
          />
        </View>

        {/* DIR Pin Control */}
        <SectionTitle title="Control PIN Direcție (DIR1)" />
        <View style={styles.row}>
          <CmdBtn
            icon="🔽"
            label="DIR1 LOW"
            sub="'L' → ≈0V"
            color="#475569"
            active={activeBtn === 'dir1_low'}
            onPress={() => send('dir1_low', 'DIR1 LOW', 'L')}
          />
          <CmdBtn
            icon="🔼"
            label="DIR1 HIGH"
            sub="'H' → ≈3.3V"
            color="#6366F1"
            active={activeBtn === 'dir1_high'}
            onPress={() => send('dir1_high', 'DIR1 HIGH', 'H')}
          />
        </View>

        {/* Log comenzi */}
        <View style={styles.logSection}>
          <View style={styles.logHeader}>
            <Text style={styles.sectionLabel}>Log Serial</Text>
            {log.length > 0 && (
              <TouchableOpacity onPress={() => setLog([])}>
                <Text style={styles.clearLog}>Șterge</Text>
              </TouchableOpacity>
            )}
          </View>

          {log.length === 0 ? (
            <View style={styles.logEmpty}>
              <Text style={styles.logEmptyText}>Nicio comandă trimisă încă.</Text>
            </View>
          ) : (
            log.map((entry) => (
              <View key={entry.id} style={styles.logEntry}>
                <Text style={[
                  styles.logText,
                  entry.type === 'ack' && styles.logAck,
                  entry.type === 'error' && styles.logError,
                ]}>
                  {entry.text}
                </Text>
                <Text style={styles.logTime}>{entry.time}</Text>
              </View>
            ))
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionLabel}>{title}</Text>;
}

function CmdBtn({ icon, label, sub, color, active, onPress }: {
  icon: string; label: string; sub: string; color: string;
  active: boolean; onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.cmdBtn, { borderColor: color, backgroundColor: active ? color + '33' : 'rgba(255,255,255,0.03)' }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={styles.cmdIcon}>{icon}</Text>
      <Text style={[styles.cmdLabel, { color: active ? color : '#F8FAFC' }]}>{label}</Text>
      <Text style={styles.cmdSub}>{sub}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0F1A' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#F8FAFC' },
  statusCol: { alignItems: 'flex-end', gap: 4 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusText: { color: '#F8FAFC', fontWeight: '700', fontSize: 13 },
  statusSubText: { color: '#64748B', fontWeight: '600', fontSize: 12 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  content: { padding: 16, paddingBottom: 40, gap: 12 },

  stopBtn: {
    backgroundColor: '#DC2626', borderRadius: 18, padding: 20,
    alignItems: 'center', gap: 4, marginBottom: 4,
    shadowColor: '#DC2626', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
  },
  stopBtnActive: { backgroundColor: '#7F1D1D', shadowOpacity: 0.1 },
  stopIcon: { fontSize: 32 },
  stopLabel: { color: '#FFF', fontSize: 20, fontWeight: '900', letterSpacing: 1 },
  stopSub: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontFamily: 'monospace' },

  sectionLabel: { fontSize: 12, fontWeight: '700', color: '#475569', letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 4 },

  row: { flexDirection: 'row', gap: 10 },

  cmdBtn: {
    flex: 1, borderWidth: 1.5, borderRadius: 16, padding: 14,
    alignItems: 'center', gap: 4, minHeight: 90,
  },
  cmdIcon: { fontSize: 22 },
  cmdLabel: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  cmdSub: { fontSize: 10, color: '#475569', fontFamily: 'monospace', textAlign: 'center' },

  logSection: {
    backgroundColor: '#0A0C14', borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', marginTop: 8,
  },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  clearLog: { color: '#EF4444', fontSize: 13, fontWeight: '600' },
  logEmpty: { alignItems: 'center', paddingVertical: 16 },
  logEmptyText: { color: '#334155', fontSize: 13 },
  logEntry: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  logText: { flex: 1, fontSize: 12, color: '#94A3B8', fontFamily: 'monospace' },
  logAck: { color: '#22C55E' },
  logError: { color: '#EF4444' },
  logTime: { fontSize: 11, color: '#334155', marginLeft: 8, fontFamily: 'monospace' },
});
