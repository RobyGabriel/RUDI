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

// ----- Date simulate -----
// În producție, acestea vor fi în baza de date Supabase
let MOCK_USERS: (User & { password: string })[] = [
  { id: '1', email: 'admin@thecon.ro', password: 'Admin123!', name: 'Administrator', office: 'IT', role: 'admin' },
  { id: '2', email: 'darius@thecon.ro', password: 'Pass123!', name: 'Darius Stoica', office: 'Birou 101', role: 'employee' },
  { id: '3', email: 'ionut@thecon.ro', password: 'Pass123!', name: 'Ionut Ichim', office: 'Birou 202', role: 'employee' },
  { id: '4', email: 'robert@thecon.ro', password: 'Pass123!', name: 'Roby Gabriel', office: 'Birou 303', role: 'employee' },
  { id: '5', email: 'cristi@thecon.ro', password: 'Pass123!', name: 'Cristi Campeanu', office: 'Birou 404', role: 'employee' },
];

// Sesiunea curentă (în memorie — va fi în SecureStore când adăugăm Supabase)
let _currentUser: User | null = null;

// ----- Autentificare -----
export const mockAuth = {
  // Încearcă să logheze un utilizator cu email + parolă
  signIn: async (email: string, password: string): Promise<{ user: User | null; error: string | null }> => {
    // Simulăm delay-ul de rețea (0.8 secunde)
    await new Promise((res) => setTimeout(res, 800));

    // Căutăm utilizatorul în lista mock
    const found = MOCK_USERS.find((u) => u.email === email && u.password === password);
    if (!found) return { user: null, error: 'Email sau parolă incorectă.' };

    // Eliminăm parola din obiectul returnat (nu trimitem parola prin aplicație!)
    const { password: _pw, ...user } = found;
    _currentUser = user;
    return { user, error: null };
  },

  // Delogare
  signOut: async (): Promise<void> => {
    _currentUser = null;
  },

  // Returnează utilizatorul curent (dacă există)
  getCurrentUser: (): User | null => _currentUser,

  // Permite schimbarea parolei de către utilizator
  changePassword: async (userId: string, newPassword: string): Promise<void> => {
    await new Promise((res) => setTimeout(res, 500));
    const idx = MOCK_USERS.findIndex((u) => u.id === userId);
    if (idx !== -1) {
      MOCK_USERS[idx].password = newPassword;
    }
  },
};

// ----- CRUD Angajați (pentru admin) -----
export const mockEmployees = {
  // Resetează parola unui angajat la cea implicită
  resetPassword: async (userId: string): Promise<string> => {
    await new Promise((res) => setTimeout(res, 500));
    const defaultPassword = 'Pass123!';
    const idx = MOCK_USERS.findIndex((u) => u.id === userId);
    if (idx !== -1) {
      MOCK_USERS[idx].password = defaultPassword;
    }
    return defaultPassword;
  },
  // Returnează toți angajații (fără admin)
  getAll: async (): Promise<User[]> => {
    await new Promise((res) => setTimeout(res, 400));
    return MOCK_USERS.filter((u) => u.role === 'employee').map(({ password: _pw, ...u }) => u);
  },

  // Creează un angajat nou
  create: async (data: Omit<User, 'id'> & { password: string }): Promise<User> => {
    const newUser = { ...data, id: String(Date.now()) };
    MOCK_USERS.push(newUser);
    const { password: _pw, ...user } = newUser;
    return user;
  },

  // Actualizează un angajat existent
  update: async (id: string, data: Partial<Omit<User, 'id'>>): Promise<void> => {
    const idx = MOCK_USERS.findIndex((u) => u.id === id);
    if (idx !== -1) Object.assign(MOCK_USERS[idx], data);
  },

  // Șterge un angajat
  delete: async (id: string): Promise<void> => {
    MOCK_USERS = MOCK_USERS.filter((u) => u.id !== id);
  },

  // Caută un angajat după ID
  getById: async (id: string): Promise<User | null> => {
    const found = MOCK_USERS.find((u) => u.id === id);
    if (!found) return null;
    const { password: _pw, ...user } = found;
    return user;
  },
};
