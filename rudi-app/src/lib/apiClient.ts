// ============================================================
// src/lib/apiClient.ts
// ------------------------------------------------------------
// Client API — face apeluri HTTP către backend-ul Python.
// ============================================================

export type UserRole = 'admin' | 'employee';

export type User = {
  id: string;
  email: string;
  name: string;
  office: string;
  role: UserRole;
};

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.0.24:8000';
const API_KEY = process.env.EXPO_PUBLIC_API_KEY || 'rudi-secret-key-2026';

// Helper pentru request-uri HTTP
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
    throw new Error('Nu se poate conecta la server. Verificați conexiunea.');
  }

  if (!response.ok) {
    let errorMessage = `HTTP error! status: ${response.status}`;
    try {
      // Verificăm dacă răspunsul este JSON înainte să parsam
      const text = await response.text();
      try {
        const errData = JSON.parse(text);
        if (errData && errData.detail) {
          errorMessage = typeof errData.detail === 'string' ? errData.detail : JSON.stringify(errData.detail);
        }
      } catch (_) {
        // Nu e JSON (ex: pagină HTML 502 de la ngrok)
        if (response.status === 502) {
          errorMessage = "Eroare de conexiune (502 Bad Gateway). Robotul este offline.";
        }
      }
    } catch (_) {}
    throw new Error(errorMessage);
  }

  return response.json();
}

function mapEmployeeToUser(emp: any): User {
  return {
    id: String(emp.id),
    email: emp.email,
    name: emp.name,
    office: emp.station_id || '',
    role: (emp.role as UserRole) || 'employee',
  };
}

import AsyncStorage from '@react-native-async-storage/async-storage';

let _currentUser: User | null = null;

// ----- Autentificare -----
export const mockAuth = {
  initAuth: async (): Promise<User | null> => {
    try {
      const stored = await AsyncStorage.getItem('rudi_user');
      if (stored) {
        const parsed = JSON.parse(stored);
        
        try {
          // Validăm dacă utilizatorul mai există la backend
          const list = await apiFetch('/employees');
          const me = list.find((e: any) => e.email === parsed.email);
          if (!me) {
            console.log('Utilizatorul a fost șters din backend. Delogare forțată.');
            await AsyncStorage.removeItem('rudi_user');
            return null;
          }
          _currentUser = mapEmployeeToUser(me);
          await AsyncStorage.setItem('rudi_user', JSON.stringify(_currentUser));
          return _currentUser;
        } catch (e) {
          // Dacă backend-ul e picat, îi permitem accesul offline/cu datele locale temporar
          console.warn('Backend indisponibil pentru validare. Păstrăm sesiunea locală.');
          _currentUser = parsed;
          return _currentUser;
        }
      }
    } catch (e) {
      console.error('Failed to load user session', e);
    }
    return null;
  },

  signIn: async (email: string, password: string): Promise<{ user: User | null; error: string | null }> => {
    try {
      const data = await apiFetch('/employees/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      const user = mapEmployeeToUser(data);
      _currentUser = user;
      await AsyncStorage.setItem('rudi_user', JSON.stringify(user));
      return { user, error: null };
    } catch (err: any) {
      return { user: null, error: err.message || 'Email sau parolă incorectă.' };
    }
  },

  signOut: async (): Promise<void> => {
    _currentUser = null;
    await AsyncStorage.removeItem('rudi_user');
  },

  getCurrentUser: (): User | null => _currentUser,
};

// ----- CRUD Angajați -----
export const mockEmployees = {
  getAll: async (): Promise<User[]> => {
    try {
      const list = await apiFetch('/employees');
      console.log('[getAll] Raw API response:', JSON.stringify(list));
      const filtered = list
        .filter((emp: any) => !emp.role || emp.role === 'employee')
        .map(mapEmployeeToUser);
      console.log('[getAll] Filtered employees:', filtered.length);
      return filtered;
    } catch (err) {
      console.error("[getAll] Eroare la preluarea angajatilor din backend:", err);
      return [];
    }
  },
};
