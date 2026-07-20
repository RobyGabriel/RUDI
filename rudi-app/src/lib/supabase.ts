// ============================================================
// src/lib/supabase.ts
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

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://dramatic-basically-mortified.ngrok-free.dev';
const API_KEY = process.env.EXPO_PUBLIC_API_KEY || 'rudi-secret-key-2026';

// Helper pentru request-uri HTTP
async function apiFetch(path: string, options: RequestInit = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': API_KEY,
    'ngrok-skip-browser-warning': 'true',
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

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
        _currentUser = JSON.parse(stored);
        return _currentUser;
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
