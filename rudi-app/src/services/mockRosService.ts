// src/services/mockRosService.ts
import { useMapStore } from '../store/useMapStore';

let pollingInterval: ReturnType<typeof setTimeout> | null = null;
let isPolling = false;

export const mockRosService = {
  
start: () => {
  if (!useMapStore.getState().mapData) {
    useMapStore.getState().loadMockMap();
  }
  if (isPolling) return;
  isPolling = true;

  const poll = async () => {
    if (!isPolling) return;
    try {
      const response = await fetch('https://dramatic-basically-mortified.ngrok-free.dev/map/full', {
        headers: {
          'X-API-Key': 'rudi-secret-key-2026',
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        }
      });
        const data = await response.clone().json();
        console.log('[mockRosService] received:', data);
      if (!response.ok) {
        console.error("Bad response", response.status, await response.text());
      } else {
        const data = await response.json();
        useMapStore.getState().setMapSnapshot(
          data.stations || [],
          data.obstacles || [],
          data.robot || undefined
        );
      }
    } catch (error) {
      console.error("Failed to fetch robot pose:", error);
    }
    
    if (isPolling) {
      pollingInterval = setTimeout(poll, 1000);
    }
  };

  pollingInterval = setTimeout(poll, 0); // kick off immediately
},

stop: () => {
  isPolling = false;
  if (pollingInterval) {
    clearTimeout(pollingInterval);
    pollingInterval = null;
  }
}
}