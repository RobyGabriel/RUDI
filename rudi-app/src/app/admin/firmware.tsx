// src/app/admin/firmware.tsx — OTA Firmware Updates Mockup (Admin)
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

export default function AdminFirmwareScreen() {
  const router = useRouter();
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdate = () => {
    Alert.alert(
      "Confirmare Update OTA",
      "Ești sigur că vrei să trimiți noul firmware către ESP32? Robotul va fi repornit.",
      [
        { text: "Anulează", style: "cancel" },
        { 
          text: "Actualizează", 
          style: "destructive",
          onPress: () => {
            setIsUpdating(true);
            setTimeout(() => {
              setIsUpdating(false);
              Alert.alert("Succes", "Firmware-ul a fost actualizat cu succes. ESP32 repornește.");
            }, 3000);
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Înapoi</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sistem & OTA</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Informații Sistem (ESP32)</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Versiune Curentă:</Text>
            <Text style={styles.value}>v1.0.4-beta</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Ultima Sincronizare:</Text>
            <Text style={styles.value}>Acum 2 minute</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Status:</Text>
            <Text style={[styles.value, { color: '#22C55E' }]}>Conectat WiFi</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Actualizare Over-The-Air</Text>
          <Text style={styles.description}>
            Când o nouă versiune de soft este disponibilă pentru microcontroller-ul robotului, aceasta poate fi descărcată și instalată de la distanță.
          </Text>

          {isUpdating ? (
            <View style={styles.updatingContainer}>
              <ActivityIndicator size="large" color="#6366F1" />
              <Text style={styles.updatingText}>Se trimite pachetul binar către ESP...</Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.updateButton} onPress={handleUpdate}>
              <Text style={styles.updateButtonText}>⬇️ Instalează Versiunea v1.1.0</Text>
            </TouchableOpacity>
          )}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#161929',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  backButton: {
    padding: 8,
    marginRight: 16,
  },
  backButtonText: {
    color: '#818CF8',
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#F8FAFC',
  },
  content: {
    padding: 16,
  },
  card: {
    backgroundColor: '#1E2235',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F8FAFC',
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  label: {
    color: '#94A3B8',
    fontSize: 15,
  },
  value: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '600',
  },
  description: {
    color: '#94A3B8',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  updateButton: {
    backgroundColor: '#4F46E5',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  updateButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  updatingContainer: {
    alignItems: 'center',
    padding: 20,
  },
  updatingText: {
    color: '#818CF8',
    marginTop: 12,
    fontWeight: '600',
  },
});
