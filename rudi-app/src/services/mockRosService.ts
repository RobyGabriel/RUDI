import { useMapStore } from '../store/useMapStore';
import { apiFetch } from '../lib/api';

let pollingInterval: ReturnType<typeof setTimeout> | null = null;
let isPolling = false;
let consecutiveErrors = 0;

// Backoff exponential: 1s, 2s, 4s, 8s, 16s, 30s (maxim)
function getRetryDelay(): number {
  const delay = Math.min(1000 * Math.pow(2, consecutiveErrors), 30000);
  return delay;
}

export const mockRosService = {

start: () => {
  if (!useMapStore.getState().mapData) {
    useMapStore.getState().loadMockMap();
  }
  if (isPolling) return;
  isPolling = true;
  consecutiveErrors = 0;

  const poll = async () => {
    if (!isPolling) return;
    try {
      const data = await apiFetch('/map/full');
      consecutiveErrors = 0; // reset backoff on success
      useMapStore.getState().setMapSnapshot(
        data.stations || [],
        data.obstacles || [],
        data.robot || undefined
      );
      if (isPolling) {
        pollingInterval = setTimeout(poll, 1000); // normal 1s poll
      }
    } catch (error) {
      consecutiveErrors++;
      const delay = getRetryDelay();
      if (consecutiveErrors <= 2) {
        // Primele 2 erori le logăm normal
        console.warn(`[MapService] Server inaccesibil. Reîncercare în ${delay / 1000}s...`);
      }
      // Altfel nu mai spamăm consola
      if (isPolling) {
        pollingInterval = setTimeout(poll, delay);
      }
    }
  };

  pollingInterval = setTimeout(poll, 0); // start imediat
},

stop: () => {
  isPolling = false;
  consecutiveErrors = 0;
  if (pollingInterval) {
    clearTimeout(pollingInterval);
    pollingInterval = null;
  }
}
}