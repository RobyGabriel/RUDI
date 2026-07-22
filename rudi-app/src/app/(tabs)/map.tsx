// ============================================================
// src/app/(tabs)/map.tsx — Panoul de Control Navigație (DOAR ADMIN)
// ============================================================

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context'; 
import MapRenderer from '../../components/mapRenderer'; 
import { useMapStore } from '../../store/useMapStore';
import { useRobotStore } from '../../store/useRobotStore';
import { apiFetch } from '../../lib/api';

type RobotOnlineStatus = 'waiting' | 'online' | 'offline';

export default function MapTabScreen() {
  const { robotPose } = useMapStore();
  const { connectionStatus } = useRobotStore();
  const [robotStatus, setRobotStatus] = useState<RobotOnlineStatus>('waiting');

  const [isTeaching, setIsTeaching] = useState(false);
  const [mapNodes, setMapNodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Funcție pentru a încărca datele hărții curente de pe server
  const loadMapData = async () => {
    try {
      const data = await apiFetch('/api/nav/map');
      setMapNodes(data.nodes || []);
      setIsTeaching(data.teach_active);
    } catch (error) {
      console.error("Eroare la încărcarea hărții:", error);
    }
  };

  useEffect(() => {
    const check = () => {
      if (!robotPose.last_updated) {
        setRobotStatus('waiting');
        return;
      }
      const age = Date.now() - new Date(robotPose.last_updated).getTime();
      setRobotStatus(age > 8000 ? 'offline' : 'online');
    };

    check(); // run immediately
    const interval = setInterval(check, 2000);
    return () => clearInterval(interval);
  }, [robotPose.last_updated]);

  useEffect(() => {
    loadMapData();
    const interval = setInterval(loadMapData, 3000);
    return () => clearInterval(interval);
  }, []);

  const robotStatusConfig = {
    waiting: { dot: '#F59E0B', text: 'Așteptând date robot...', icon: '📡' },
    online:  { dot: '#22C55E', text: 'Robot Online',            icon: '🟢' },
    offline: { dot: '#EF4444', text: 'Robot Offline',           icon: '🔴' },
  }[robotStatus];

  const serverConnected = connectionStatus === 'connected';

  // --- ACTIUNI TEACH MODE ---
  const handleStartTeach = async () => {
    setLoading(true);
    try {
      await apiFetch('/api/nav/teach/start', { method: 'POST' });
      setIsTeaching(true);
      Alert.alert("Succes", "Modul de învățare a pornit! Acum condu robotul.");
    } catch (err: any) {
      Alert.alert("Eroare", err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStopTeach = async () => {
    setLoading(true);
    try {
      await apiFetch('/api/nav/teach/stop', { method: 'POST' });
      setIsTeaching(false);
      Alert.alert("Salvat", "Modul de învățare a fost oprit și harta salvată.");
      loadMapData();
    } catch (err: any) {
      Alert.alert("Eroare", err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateTag = async (tagName: string) => {
    try {
      await apiFetch('/api/nav/teach/tag', {
        method: 'POST',
        body: JSON.stringify({ tag_id: tagName }),
      });
      loadMapData();
    } catch (err: any) {
      Alert.alert("Eroare RFID", err.message);
    }
  };

  const handleSimulateMove = async (ticks: number) => {
    try {
      await apiFetch('/api/nav/teach/move', {
        method: 'POST',
        body: JSON.stringify({ ticks_delta: ticks, action: 'STRAIGHT', param_cm: 25.0 }),
      });
    } catch (err: any) {
      Alert.alert("Eroare Move", err.message);
    }
  };

  const handleClearMap = async () => {
    Alert.alert("Ștergere Harta", "Ești sigur? Toate rutele învățate se vor pierde!", [
      { text: "Anulează", style: "cancel" },
      { 
        text: "Șterge", 
        style: "destructive", 
        onPress: async () => {
          try {
            await apiFetch('/api/nav/map', { method: 'DELETE' });
            loadMapData();
          } catch (err: any) {
            Alert.alert("Eroare", err.message);
          }
        }
      }
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header informativ */}
        <View style={styles.header}>
          {/* Stânga: starea robotului fizic */}
          <View style={styles.statusCol}>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: robotStatusConfig.dot }]} />
              <Text style={styles.statusText}>{robotStatusConfig.text}</Text>
            </View>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: serverConnected ? '#6366F1' : '#475569' }]} />
              <Text style={styles.statusSubText}>
                Server: {serverConnected ? 'Conectat' : connectionStatus}
              </Text>
            </View>
          </View>

          {/* Dreapta: baterie */}
          {robotPose.battery !== undefined && (
            <View style={styles.batteryContainer}>
              <Text style={[styles.batteryText, robotPose.battery < 20 && styles.batteryLow]}>
                🔋 {robotPose.battery}%
              </Text>
              {robotPose.battery < 20 && (
                <Text style={styles.batteryWarning}>Baterie descărcată!</Text>
              )}
            </View>
          )}
        </View>

        <MapRenderer />

        {/* --- ADMIN NAVIGATION CONSOLE --- */}
        <View style={styles.content}>
          <View style={styles.adminHeader}>
            <Text style={styles.title}>Consolă Navigație</Text>
            <View style={[styles.badge, { backgroundColor: isTeaching ? 'rgba(239,68,68,0.2)' : 'rgba(99,102,241,0.2)' }]}>
              <Text style={[styles.badgeText, { color: isTeaching ? '#EF4444' : '#818CF8' }]}>
                {isTeaching ? "🔴 TEACHING ACTIVE" : "🟢 STANDBY"}
              </Text>
            </View>
          </View>

          {/* CONTROALE PRINCIPALE */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Modul de Învățare (Teach Mode)</Text>
            <Text style={styles.description}>
              Când acest mod este activ, mișcările robotului pe hol și tag-urile RFID citite vor crea harta internă.
            </Text>

            {!isTeaching ? (
              <TouchableOpacity style={styles.btnStart} onPress={handleStartTeach} disabled={loading}>
                <Text style={styles.btnText}>Pornire Învățare</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.btnStop} onPress={handleStopTeach} disabled={loading}>
                <Text style={styles.btnText}>Oprire și Salvare Hartă</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* SIMULARE SENZORI */}
          {isTeaching && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Simulare Senzori (Hardware Lipsă)</Text>
              <Text style={styles.description}>Apasă pentru a trimite un semnal fals către server, ca și cum robotul s-ar fi mișcat.</Text>
              
              <View style={styles.grid}>
                <TouchableOpacity style={styles.btnSimulate} onPress={() => handleSimulateMove(500)}>
                  <Text style={styles.btnSimulateText}>Avansează +500 Ticks</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnSimulateTag} onPress={() => handleSimulateTag("TAG_BIROU_1")}>
                  <Text style={styles.btnSimulateText}>Găsit TAG_BIROU_1</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnSimulateTag} onPress={() => handleSimulateTag("TAG_HOL")}>
                  <Text style={styles.btnSimulateText}>Găsit TAG_HOL</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnSimulateTag} onPress={() => handleSimulateTag("TAG_BIROU_2")}>
                  <Text style={styles.btnSimulateText}>Găsit TAG_BIROU_2</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* AFISARE HARTA GRAF */}
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.sectionTitle}>Harta Curentă (Graf)</Text>
              <TouchableOpacity onPress={handleClearMap}>
                <Text style={{ color: '#EF4444', fontSize: 13, fontWeight: 'bold' }}>Șterge Tot</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.description}>
              Noduri RFID cunoscute ({mapNodes.length}):
            </Text>
            
            {mapNodes.length === 0 ? (
              <Text style={styles.emptyText}>Harta este complet goală.</Text>
            ) : (
              <View style={styles.tagsContainer}>
                {mapNodes.map((node, i) => (
                  <View key={i} style={styles.tagBadge}>
                    <Text style={styles.tagText}>🏷️ {node}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0F1A',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    backgroundColor: '#161929',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    zIndex: 10,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusCol: {
    gap: 4,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusText: {
    color: '#F8FAFC',
    fontWeight: '700',
    fontSize: 14,
  },
  statusSubText: {
    color: '#64748B',
    fontWeight: '600',
    fontSize: 12,
  },
  batteryContainer: {
    alignItems: 'flex-end',
  },
  batteryText: {
    color: '#F8FAFC',
    fontWeight: '700',
    fontSize: 14,
  },
  batteryLow: {
    color: '#EF4444',
  },
  batteryWarning: {
    color: '#EF4444',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  
  content: { padding: 20 },
  adminHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, marginTop: 10 },
  title: { fontSize: 24, fontWeight: '800', color: '#F8FAFC' },
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  badgeText: { fontSize: 12, fontWeight: '800' },

  card: { backgroundColor: '#161929', borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#F8FAFC', marginBottom: 8 },
  description: { fontSize: 14, color: '#94A3B8', marginBottom: 16, lineHeight: 20 },

  btnStart: { backgroundColor: '#6366F1', padding: 16, borderRadius: 12, alignItems: 'center' },
  btnStop: { backgroundColor: '#EF4444', padding: 16, borderRadius: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  btnSimulate: { backgroundColor: '#334155', padding: 12, borderRadius: 8, flexGrow: 1, alignItems: 'center' },
  btnSimulateTag: { backgroundColor: '#0F766E', padding: 12, borderRadius: 8, flexGrow: 1, alignItems: 'center' },
  btnSimulateText: { color: '#F8FAFC', fontWeight: '600', fontSize: 13 },

  emptyText: { color: '#64748B', fontStyle: 'italic', marginTop: 10 },
  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  tagBadge: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  tagText: { color: '#E2E8F0', fontWeight: '600', fontSize: 13 },
});