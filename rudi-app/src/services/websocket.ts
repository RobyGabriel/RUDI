import { useRobotStore } from "../store/useRobotStore";

let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let isIntentionallyClosed = false;

export function connectWebSocket(url: string) {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  
  isIntentionallyClosed = false;
  useRobotStore.getState().setConnectionStatus("connecting");
  console.log("Încercare conectare WebSocket la:", url);

  try {
    socket = new WebSocket(url);

    socket.onopen = () => {
      console.log("WebSocket conectat cu succes.");
      useRobotStore.getState().setConnectionStatus("connected");
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        useRobotStore.getState().setLastMessage(data);
      } catch (e) {
        // Ignorăm silențios mesajele non-JSON (ex: mesajele brute destinate STM32-ului)
        console.log("Ignorat mesaj non-JSON de la websocket:", event.data);
      }
    };

    socket.onerror = (err) => {
      console.log("WebSocket eroare:", err);
      useRobotStore.getState().setConnectionStatus("error");
    };

    socket.onclose = () => {
      console.log("WebSocket închis.");
      if (useRobotStore.getState().connectionStatus !== "error") {
        useRobotStore.getState().setConnectionStatus("disconnected");
      }
      
      if (!isIntentionallyClosed) {
        console.log("Programare reconectare în 3 secunde...");
        reconnectTimer = setTimeout(() => {
          connectWebSocket(url);
        }, 3000);
      }
    };
  } catch (error) {
    console.error("Eroare la instanțierea WebSocket:", error);
    useRobotStore.getState().setConnectionStatus("error");
    if (!isIntentionallyClosed) {
      reconnectTimer = setTimeout(() => {
        connectWebSocket(url);
      }, 3000);
    }
  }

  return socket;
}

export function disconnectWebSocket() {
  isIntentionallyClosed = true;
  if (socket) {
    socket.close();
    socket = null;
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  useRobotStore.getState().setConnectionStatus("disconnected");
}

export function sendCommand(command: object) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(command));
  } else {
    console.log("WebSocket nu e conectat încă");
  }
}