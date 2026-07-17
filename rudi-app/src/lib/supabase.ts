// ============================================================
// src/lib/supabase.ts
// ------------------------------------------------------------
// FISIER MOCK — simulează Supabase fără baza de date reală.
// CÂND SUPABASE E GATA: înlocuiești conținutul acestui fișier
// cu clientul real Supabase. Restul aplicației NU se modifică.
// ============================================================

export type UserRole = 'admin' | 'employee';

export type User = {
  id: string;
  email: string;
  name: string;
  office: string;
  role: UserRole;
};

// Sesiunea curentă (în memorie)
let _currentUser: User | null = null;

// Funcție ajutătoare pentru URL-ul bazei de date și cheia API
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.0.22:8000';
const API_KEY = process.env.EXPO_PUBLIC_API_KEY || 'rudi-secret-key-2026';

// Wrapper peste fetch pentru a adăuga mereu cheia API
const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
  const headers = {
    ...options.headers,
    'x-api-key': API_KEY,
  };
  return fetch(`${API_URL}${endpoint}`, { ...options, headers });
};

// ----- Autentificare -----
export const mockAuth = {
  // Încearcă să logheze un utilizator cu email + parolă
  signIn: async (email: string, password: string): Promise<{ user: User | null; error: string | null }> => {
    try {
      const response = await apiFetch('/employees/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        return { user: null, error: 'Email sau parolă incorectă.' };
      }

      const data = await response.json();
      
      // Mapăm datele de la Python la interfața de User așteptată de aplicație
      const user: User = {
        id: String(data.id),
        email: data.email,
        name: data.name,
        office: data.station_id,
        role: data.role as UserRole
      };
      
      _currentUser = user;
      return { user, error: null };
    } catch (err) {
      console.error("Eroare la login:", err);
      return { user: null, error: 'Eroare de rețea. Serverul este pornit?' };
    }
  },

  // Delogare
  signOut: async (): Promise<void> => {
    _currentUser = null;
  },

  // Returnează utilizatorul curent (dacă există)
  getCurrentUser: (): User | null => _currentUser,

  // Permite schimbarea parolei de către utilizator
  changePassword: async (userId: string, newPassword: string): Promise<void> => {
    await apiFetch(`/employees/${userId}/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_password: newPassword })
    });
  },
};

// ----- CRUD Angajați (pentru admin) -----
export const mockEmployees = {
  // Resetează parola unui angajat la cea implicită
  resetPassword: async (userId: string): Promise<string> => {
    const res = await apiFetch(`/employees/${userId}/reset-password`, {
      method: 'POST',
    });
    const data = await res.json();
    return data.default_password || 'Pass123!';
  },
  
  // Returnează toți angajații (fără admin)
  getAll: async (): Promise<User[]> => {
    try {
      const res = await apiFetch(`/employees`);
      const data = await res.json();
      
      // Mapăm în formatul dorit de aplicație
      return data
        .filter((u: any) => u.role === 'employee')
        .map((u: any) => ({
          id: String(u.id),
          email: u.email,
          name: u.name,
          office: u.station_id,
          role: u.role as UserRole
        }));
    } catch (err) {
      console.error("Eroare get employees:", err);
      return [];
    }
  },

  // Creează un angajat nou
  create: async (data: Omit<User, 'id'> & { password: string }): Promise<User> => {
    const res = await apiFetch(`/employees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: data.name,
        email: data.email,
        station_id: data.office,
        password: data.password,
        role: data.role
      })
    });
    const u = await res.json();
    return {
      id: String(u.id),
      email: u.email,
      name: u.name,
      office: u.station_id,
      role: u.role as UserRole
    };
  },

  // Actualizează un angajat existent
  update: async (id: string, data: Partial<Omit<User, 'id'>>): Promise<void> => {
    const payload: any = {};
    if (data.name) payload.name = data.name;
    if (data.email) payload.email = data.email;
    if (data.office) payload.station_id = data.office;
    if (data.role) payload.role = data.role;

    await apiFetch(`/employees/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  },

  // Șterge un angajat
  delete: async (id: string): Promise<void> => {
    await apiFetch(`/employees/${id}`, { method: 'DELETE' });
  },

  // Caută un angajat după ID
  getById: async (id: string): Promise<User | null> => {
    try {
      const res = await apiFetch(`/employees/${id}`);
      if (!res.ok) return null;
      const u = await res.json();
      return {
        id: String(u.id),
        email: u.email,
        name: u.name,
        office: u.station_id,
        role: u.role as UserRole
      };
    } catch {
      return null;
    }
  },
};
