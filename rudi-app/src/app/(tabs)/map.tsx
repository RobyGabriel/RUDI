import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context'; 
import MapRenderer from '../../components/mapRenderer'; 
import { useMapStore } from '../../store/useMapStore';
import { useRobotStore } from '../../store/useRobotStore';

type RobotOnlineStatus = 'waiting' | 'online' | 'offline';

export default function MapTabScreen() {
  const { robotPose } = useMapStore();
  const { connectionStatus } = useRobotStore();
  const [robotStatus, setRobotStatus] = useState<RobotOnlineStatus>('waiting');

  useEffect(() => {
    const check = () => {
      if (!robotPose.last_updated) {
        // Nu am primit niciodată date de la robot — nu înseamnă offline, ci "așteptăm"
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

  const robotStatusConfig = {
    waiting: { dot: '#F59E0B', text: 'Așteptând date robot...', icon: '📡' },
    online:  { dot: '#22C55E', text: 'Robot Online',            icon: '🟢' },
    offline: { dot: '#EF4444', text: 'Robot Offline',           icon: '🔴' },
  }[robotStatus];

  const serverConnected = connectionStatus === 'connected';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0F1A',
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
});