import React, { useEffect } from 'react';
import { View, StyleSheet, Text, Dimensions } from 'react-native';
import { useMapStore } from '../store/useMapStore';
import { mockRosService } from '../services/mockRosService';

const PIXELS_PER_METER = 40;
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const VIEWPORT_HEIGHT = SCREEN_HEIGHT * 0.7; // portion of screen dedicated to the map

export default function MapRenderer() {
  const { mapData, robotPose, stations, obstacles } = useMapStore();

  useEffect(() => {
    // Just start the service. It handles everything else.
    mockRosService.start();

    // Clean up when the user navigates away to a different tab
    return () => mockRosService.stop();
  }, []); // <-- Empty array is crucial! It means this only runs exactly once.

  if (!mapData) {
    return (
      <View style={styles.center}>
        <Text>Loading Map Data...</Text>
      </View>
    );
  }

  const cellPixelSize = mapData.resolution * PIXELS_PER_METER;
  const mapPixelWidth = mapData.width * cellPixelSize;
  const mapPixelHeight = mapData.height * cellPixelSize;

  // Robot's position within the (static) map coordinate space
  const robotPixelX = robotPose.x * PIXELS_PER_METER;
  const robotPixelY = mapPixelHeight - (robotPose.y * PIXELS_PER_METER);

  // Offset applied to mapArea so the robot always sits centered in the viewport
  const offsetX = (SCREEN_WIDTH / 2) - robotPixelX;
  const offsetY = (VIEWPORT_HEIGHT / 2) - robotPixelY;

  return (
    <View style={styles.container}>
      <View style={[styles.viewport, { width: SCREEN_WIDTH, height: VIEWPORT_HEIGHT }]}>
        <View
          style={[
            styles.mapArea,
            {
              width: mapPixelWidth,
              height: mapPixelHeight,
              transform: [{ translateX: offsetX }, { translateY: offsetY }],
            },
          ]}
        >
          {/* Draw Walls */}
          {mapData.grid.map((cellValue, index) => {
            if (cellValue < 50) return null;
            const gridX = index % mapData.width;
            const gridY = Math.floor(index / mapData.width);
            return (
              <View
                key={`wall-${index}`}
                style={[
                  styles.wallBlock,
                  {
                    width: cellPixelSize,
                    height: cellPixelSize,
                    left: gridX * cellPixelSize,
                    top: (mapData.height - 1 - gridY) * cellPixelSize,
                  },
                ]}
              />
            );
          })}

          {/* Draw Stations (Desks) */}
          {stations
            .filter((station) => station.x != null && station.y != null)
            .map((station) => (
              <View
                key={`station-${station.station_id}`}
                style={[
                  styles.station,
                  {
                    left: (station.x * PIXELS_PER_METER) - 15,
                    top: mapPixelHeight - (station.y * PIXELS_PER_METER) - 15,
                  },
                ]}
              >
                <Text style={styles.stationText}>{station.name.charAt(0)}</Text>
              </View>
            ))}

          {/* Draw Obstacles */}
          {obstacles.map((obs) => (
            <View
              key={`obs-${obs.id}`}
              style={[
                styles.obstacle,
                {
                  left: obs.x1 * PIXELS_PER_METER,
                  top: mapPixelHeight - (obs.y1 * PIXELS_PER_METER),
                  width: (obs.x2 - obs.x1) * PIXELS_PER_METER,
                  height: Math.abs(obs.y2 - obs.y1) * PIXELS_PER_METER,
                },
              ]}
            />
          ))}

          {/* Draw Robot */}
          <View
            style={[
              styles.robot,
              {
                left: robotPixelX - 12,
                top: robotPixelY - 12,
                transform: [{ rotate: `${-robotPose.heading}rad` }],
              },
            ]}
          >
            <View style={styles.robotFront} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', paddingTop: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  viewport: {
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#e9ecef',
  },
  mapArea: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#ced4da',
  },
  wallBlock: { position: 'absolute', backgroundColor: '#343a40' },
  robot: {
    position: 'absolute', width: 24, height: 24, backgroundColor: '#007AFF',
    borderRadius: 12, justifyContent: 'center', alignItems: 'center', zIndex: 10,
  },
  robotFront: { width: '50%', height: 4, backgroundColor: '#FF3B30', position: 'absolute', right: 0 },
  station: {
    position: 'absolute', width: 30, height: 30, backgroundColor: '#34C759',
    borderRadius: 6, justifyContent: 'center', alignItems: 'center', zIndex: 5,
  },
  stationText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  obstacle: { position: 'absolute', backgroundColor: 'rgba(255, 59, 48, 0.5)', zIndex: 6 },
});