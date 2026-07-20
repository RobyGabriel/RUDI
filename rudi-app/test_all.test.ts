import { useMapStore } from './src/store/useMapStore';
import { apiFetch } from './src/lib/api';
import { mockRosService } from './src/services/mockRosService';

// Suprascriem `fetch`-ul global pentru a nu face call-uri reale în rețea în timpul testelor
global.fetch = jest.fn();

describe('RUDI App Core Functionality', () => {
  
  // Resetăm starea și mock-urile înainte de fiecare test
  beforeEach(() => {
    jest.clearAllMocks();
    useMapStore.setState({
      mapData: null,
      robotPose: { x: 0, y: 0, heading: 0 },
      stations: [],
      obstacles: []
    });
  });

  describe('1. Store (useMapStore.ts)', () => {
    it('ar trebui să fie inițializat cu valorile default', () => {
      const state = useMapStore.getState();
      expect(state.mapData).toBeNull();
      expect(state.robotPose).toEqual({ x: 0, y: 0, heading: 0 });
      expect(state.stations).toEqual([]);
      expect(state.obstacles).toEqual([]);
    });

    it('ar trebui să încarce mock map corect', () => {
      useMapStore.getState().loadMockMap();
      const state = useMapStore.getState();
      expect(state.mapData).not.toBeNull();
      expect(state.mapData?.width).toBe(50);
      expect(state.mapData?.height).toBe(30);
    });

    it('ar trebui să actualizeze poziția robotului', () => {
      useMapStore.getState().updateRobotPose({ x: 10, y: 15, heading: 1.5 });
      const state = useMapStore.getState();
      expect(state.robotPose).toEqual({ x: 10, y: 15, heading: 1.5 });
    });

    it('ar trebui să seteze complet harta (snapshot) de la backend', () => {
      const mockStations = [{ name: 'S1', station_id: 'S1', x: 5, y: 5 }];
      const mockObstacles = [{ id: 1, x1: 0, y1: 0, x2: 1, y2: 1, detected_at: 'now' }];
      const mockRobot = { x: 2, y: 2, heading: 0, is_moving: true };
      
      useMapStore.getState().setMapSnapshot(mockStations, mockObstacles, mockRobot);
      
      const state = useMapStore.getState();
      expect(state.stations).toEqual(mockStations);
      expect(state.obstacles).toEqual(mockObstacles);
      expect(state.robotPose).toEqual(mockRobot);
    });
  });

  describe('2. API Fetch Wrapper (api.ts)', () => {
    it('ar trebui să facă request cu header-ele corecte', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      const data = await apiFetch('/test-endpoint');
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/test-endpoint'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'x-api-key': expect.any(String)
          })
        })
      );
      expect(data).toEqual({ success: true });
    });

    it('ar trebui să arunce o eroare dacă request-ul eșuează', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ detail: 'Not found error message' })
      });

      await expect(apiFetch('/test-endpoint')).rejects.toThrow('Not found error message');
    });
  });

  describe('3. ROS Service (mockRosService.ts)', () => {
    it('ar trebui să inițieze polling-ul și să actualizeze datele', async () => {
      jest.useFakeTimers();
      
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        clone: () => ({ json: async () => ({}) }),
        json: async () => ({
          stations: [{ name: 'ST-01', station_id: 'ST-01', x: 10, y: 10 }],
          obstacles: [],
          robot: { x: 5, y: 5, heading: 0, is_moving: false }
        })
      });

      // Pornim serviciul de background care face fetch din 1 in 1 secundă
      mockRosService.start();
      
      // Derulăm timpul intern Jest ca să se execute callback-ul async imediat
      await jest.runOnlyPendingTimersAsync();
      
      const state = useMapStore.getState();
      expect(state.stations.length).toBe(1);
      expect(state.robotPose.x).toBe(5);
      
      // Oprim serviciul
      mockRosService.stop();
      jest.useRealTimers();
    });
  });
});
