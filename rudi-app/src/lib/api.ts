// ============================================================
// src/lib/api.ts
// ------------------------------------------------------------
// Helper pentru apeluri HTTP directe către backend-ul Python.
// ============================================================

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://dramatic-basically-mortified.ngrok-free.dev';
const API_KEY = process.env.EXPO_PUBLIC_API_KEY || 'rudi-secret-key-2026';

export async function apiFetch(path: string, options: RequestInit = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': API_KEY,
    'ngrok-skip-browser-warning': 'true',
    ...(options.headers || {}),
  };

  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
    });
  } catch (networkError: any) {
    // Eroare de rețea (ex. server offline, lipsă internet)
    throw new Error('Nu se poate conecta la server. Verificați conexiunea.');
  }

  if (!response.ok) {
    let errorMessage = `HTTP error! status: ${response.status}`;
    try {
      const errData = await response.json();
      if (errData && errData.detail) {
        errorMessage = typeof errData.detail === 'string' ? errData.detail : JSON.stringify(errData.detail);
      }
    } catch (_) {}
    throw new Error(errorMessage);
  }

  return response.json();
}
