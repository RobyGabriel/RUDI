import { useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { connectWebSocket, sendCommand } from "../../services/websocket";
import { useRobotStore } from "../../store/useRobotStore";

export default function HomeScreen() {
  const connectionStatus = useRobotStore((state) => state.connectionStatus);
  const lastMessage = useRobotStore((state) => state.lastMessage);
  const setLastMessage = useRobotStore((state) => state.setLastMessage); // ← adaugă asta

  useEffect(() => {
    const ws = connectWebSocket(process.env.EXPO_PUBLIC_WS_URL!);
    return () => ws.close();
  }, []);

  const handleTest = () => {
    sendCommand({ target_employee: "Darius", status: "call" });
  };

  // TEST TEMPORAR — scrie direct în store, fără WebSocket
  const handleZustandTest = () => {
    setLastMessage({ test: "Zustand functioneaza!", timestamp: Date.now() });
  };

  const statusColor = {
    connecting: "#f5a623",
    connected: "#4caf50",
    disconnected: "#9e9e9e",
    error: "#f44336",
  }[connectionStatus];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Rudi Robot</Text>

      <View style={styles.statusRow}>
        <View style={[styles.dot, { backgroundColor: statusColor }]} />
        <Text style={styles.statusText}>WebSocket: {connectionStatus}</Text>
      </View>

      <TouchableOpacity style={styles.button} onPress={handleTest}>
        <Text style={styles.buttonText}>Trimite comandă test</Text>
      </TouchableOpacity>

      {/* BUTON NOU DE TEST */}
      <TouchableOpacity style={[styles.button, { backgroundColor: "#9c27b0" }]} onPress={handleZustandTest}>
        <Text style={styles.buttonText}>Test Zustand (fără WebSocket)</Text>
      </TouchableOpacity>

      <Text style={styles.label}>Ultimul mesaj primit:</Text>
      <Text style={styles.message}>
        {lastMessage ? JSON.stringify(lastMessage) : "—"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20, backgroundColor: "#fff" },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 30 },
  statusRow: { flexDirection: "row", alignItems: "center", marginBottom: 30 },
  dot: { width: 12, height: 12, borderRadius: 6, marginRight: 8 },
  statusText: { fontSize: 16 },
  button: { backgroundColor: "#2196f3", paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8, marginBottom: 16 },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  label: { fontSize: 14, color: "#666" },
  message: { fontSize: 14, marginTop: 4, fontFamily: "monospace" },
});