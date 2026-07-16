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
};

type MapStore = {
  mapData: MapData | null;
  robotPose: RobotPose;
  setMapData: (data: MapData) => void;
  updateRobotPose: (pose: Partial<RobotPose>) => void;
  loadMockMap: () => void;
};

// --- Store ---
export const useMapStore = create<MapStore>((set) => ({
  mapData: null,
  robotPose: { x: 0, y: 0, heading: 0 },

  setMapData: (data) => set({ mapData: data }),
  
  updateRobotPose: (pose) => set((state) => ({ 
    robotPose: { ...state.robotPose, ...pose } 
  })),

  // Generates a simple 10x10 mock room with a wall in the middle
  loadMockMap: () => {
    const width = 10;
    const height = 10;
    const grid = new Array(width * height).fill(0); // Fill with free space (0)
    
    // Draw a fake wall (value 100)
    for(let i = 2; i < 8; i++) {
        grid[i * width + 5] = 100; 
    }

    set({
      mapData: {
        width,
        height,
        resolution: 0.5, // each cell is 0.5 meters
        origin: { x: 0, y: 0 },
        grid
      },
      // Start the robot in a safe spot
      robotPose: { x: 2, y: 2, heading: 0 }
    });
  }
}));