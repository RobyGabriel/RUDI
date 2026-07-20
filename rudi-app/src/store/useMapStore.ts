import { create } from 'zustand';

// --- Types ---
export type MapData = {
  width: number;
  height: number;
  resolution: number; // meters per pixel
  origin: { x: number; y: number }; 
  grid: number[]; // 1D array representing the 2D occupancy grid
};

export type RobotPose = {
  x: number; // in meters
  y: number; // in meters
  heading: number; // in radians
  is_moving?: boolean;
  battery?: number; // percentage 0-100
  last_updated?: string; // ISO date string
  last_command_ack?: string; // e.g. 'call_robot'
};

// Types matching your Python backend
export type Station = {
  name: string;
  station_id: string;
  x: number;
  y: number;
};

export type Obstacle = {
  id: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  detected_at: string;
};

// Pregătire pentru senzori avansați pe viitor
export type SensorData = {
  id: string;
  type: 'ultrasonic' | 'lidar' | 'ir' | 'camera';
  distance: number;
  confidence: number;
  timestamp: string;
};

type MapStore = {
  mapData: MapData | null;
  robotPose: RobotPose;
  stations: Station[];
  obstacles: Obstacle[];
  sensorReadings: SensorData[];
  
  setMapData: (data: MapData) => void;
  updateRobotPose: (pose: Partial<RobotPose>) => void;
  setMapSnapshot: (stations: Station[], obstacles: Obstacle[], robot?: RobotPose) => void;
  loadMockMap: () => void;
};

export const useMapStore = create<MapStore>((set) => ({
  mapData: null,
  robotPose: { x: 0, y: 0, heading: 0 },
  stations: [],
  obstacles: [],
  sensorReadings: [],

  setMapData: (data) => set({ mapData: data }),
  
  updateRobotPose: (pose) => set((state) => ({ 
    robotPose: { ...state.robotPose, ...pose } 
  })),

  // Save the full snapshot from the Python backend
  setMapSnapshot: (stations, obstacles, robot) => set((state) => ({
    stations,
    obstacles,
    // Only update the robot if the backend sent valid coordinates
    robotPose: robot ? { ...state.robotPose, ...robot } : state.robotPose
  })),

  // Generates a simple 10x10 mock room with a wall in the middle
  loadMockMap: () => {
    const width = 50;
    const height = 30;
    const grid = new Array(width * height).fill(0); 
    
    for(let i = 2; i < 8; i++) {
        grid[i * width + 5] = 100; 
    }

    set({
      mapData: {
        width,
        height,
        resolution: 0.5, 
        origin: { x: 0, y: 0 },
        grid
      }
    });
  }
}));