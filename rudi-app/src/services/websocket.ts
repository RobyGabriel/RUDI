import { useRobotStore } from "../store/useRobotStore";

let socket: WebSocket | null = null;

export function connectWebSocket(url: string) {
  socket = new WebSocket(url);

  socket.onopen = () => {
    useRobotStore.getState().setConnectionStatus("connected");
  };

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    useRobotStore.getState().setLastMessage(data);
  };

  socket.onerror = () => {
    useRobotStore.getState().setConnectionStatus("error");
  };

  socket.onclose = () => {
    useRobotStore.getState().setConnectionStatus("disconnected");
  };

  return socket;
}

export function sendCommand(command: object) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(command));
  } else {
    console.log("WebSocket nu e conectat încă");
  }
}