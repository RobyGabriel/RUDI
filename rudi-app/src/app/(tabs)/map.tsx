// app/(tabs)/map.tsx
import React from 'react';
import { StyleSheet } from 'react-native';
// IMPORT FROM THE NEW LIBRARY:
import { SafeAreaView } from 'react-native-safe-area-context'; 
import mapRenderer from '../../components/mapRenderer';

export default function MapTabScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {mapRenderer()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});