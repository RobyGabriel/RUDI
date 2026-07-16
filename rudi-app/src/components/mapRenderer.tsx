import React, { useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useMapStore } from '../store/useMapStore';

const PIXELS_PER_METER = 40; 

export default function mapRenderer() {
  const { mapData, robotPose, loadMockMap, updateRobotPose } = useMapStore();

  useEffect(() => {
    if (!mapData) {
      loadMockMap();
    }
  }, [mapData, loadMockMap]);

  if (!mapData) {
    return (
      <View style={styles.center}>
        <Text>Loading Map...</Text>
      </View>
    );
  }

  const cellPixelSize = mapData.resolution * PIXELS_PER_METER;
  const mapPixelWidth = mapData.width * cellPixelSize;
  const mapPixelHeight = mapData.height * cellPixelSize;

  return (
    <View style={styles.container}>
      <View style={[styles.mapArea, { width: mapPixelWidth, height: mapPixelHeight }]}>
        
        {mapData.grid.map((cellValue, index) => {
          if (cellValue < 50) return null;

          const gridX = index % mapData.width;
          const gridY = Math.floor(index / mapData.width);

          return (
            <View
              key={index}
              style={[
                styles.wallBlock,
                {
                  width: cellPixelSize,
                  height: cellPixelSize,
                  left: gridX * cellPixelSize,
                  top: (mapData.height - 1 - gridY) * cellPixelSize,
                }
              ]}
            />
          );
        })}

        <View
          style={[
            styles.robot,
            {
              left: (robotPose.x * PIXELS_PER_METER) - (styles.robot.width / 2),
              top: mapPixelHeight - (robotPose.y * PIXELS_PER_METER) - (styles.robot.height / 2),
              transform: [{ rotate: `${-robotPose.heading}rad` }]
            }
          ]}
        >
          <View style={styles.robotFront} />
        </View>
      </View>

      <View style={styles.controls}>
        <Text style={{ fontWeight: 'bold', marginBottom: 10 }}>Test Controls</Text>
        <View style={styles.row}>
          <TouchableOpacity 
            style={styles.button} 
            onPress={() => updateRobotPose({ x: robotPose.x - 0.5 })}
          >
            <Text>Left</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.button} 
            onPress={() => updateRobotPose({ x: robotPose.x + 0.5 })}
          >
            <Text>Right</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', paddingTop: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  mapArea: {
    backgroundColor: '#e9ecef',
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#ced4da',
  },
  wallBlock: { position: 'absolute', backgroundColor: '#343a40' },
  robot: {
    position: 'absolute',
    width: 20,
    height: 20,
    backgroundColor: '#007AFF',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  robotFront: { width: '50%', height: 3, backgroundColor: '#FF3B30', position: 'absolute', right: 0 },
  controls: { marginTop: 40, padding: 20, backgroundColor: '#f8f9fa', borderRadius: 8, alignItems: 'center' },
  row: { flexDirection: 'row', gap: 10 },
  button: { padding: 10, backgroundColor: '#e0e0e0', borderRadius: 5 }
});