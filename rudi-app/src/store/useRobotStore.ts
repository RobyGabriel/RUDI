import { create } from "zustand";

type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

type RobotStatus = {
  target_employee?: string;
  status?: string;
  [key: string]: any; // pentru câmpuri viitoare (poziție, baterie, etc.)
};

type RobotStore = {
  connectionStatus: ConnectionStatus;
  lastMessage: RobotStatus | null;
  setConnectionStatus: (status: ConnectionStatus) => void;
  setLastMessage: (data: RobotStatus) => void;
};

export const useRobotStore = create<RobotStore>((set) => ({
  connectionStatus: "connecting",
  lastMessage: null,
  setConnectionStatus: (status) => set({ connectionStatus: status }),
  setLastMessage: (data) => set({ lastMessage: data }),
}));