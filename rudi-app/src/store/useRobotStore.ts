// ============================================================
// src/store/useRobotStore.ts
// ------------------------------------------------------------
// Starea globală a aplicației — accesibilă din orice ecran.
// Zustand = o variabilă globală simplă, cu re-render automat.
// ============================================================

import { create } from 'zustand';
import { User } from '../lib/supabase';

// Tipuri posibile pentru conexiunea WebSocket
type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

// Tipuri posibile pentru starea robotului (Flux extins în doi pași)
type RobotStatus =
  | 'idle'                 // Liber — poate fi chemat
  | 'coming_to_sender'     // În drum spre expeditor (cel care l-a chemat)
  | 'arrived_at_sender'    // A sosit la expeditor (gata de încărcat foi)
  | 'in_transit'           // În drum spre destinatar
  | 'arrived';             // A sosit la destinatar (așteaptă confirmarea primirii)

// Detaliile livrării curente
type Delivery = {
  from: User;       // Cine a trimis
  to: User | null;  // Cine primește (devine User după ce expeditorul îl alege)
  startedAt: number; // Timestamp (milisecunde) când a pornit
};

// Structura unei notificări din Inbox
export type AppNotification = {
  id: string;
  from: User;
  to: User;
  status: 'in_transit' | 'delivered';
  timestamp: number;
};

// Forma completă a store-ului
type RobotStore = {
  // --- Conexiune WebSocket ---
  connectionStatus: ConnectionStatus;
  lastMessage: Record<string, unknown> | null;
  setConnectionStatus: (status: ConnectionStatus) => void;
  setLastMessage: (data: Record<string, unknown>) => void;

  // --- Utilizator logat ---
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;

  // --- Robot ---
  robotStatus: RobotStatus;
  currentDelivery: Delivery | null;

  // --- Inbox / Notificări ---
  notifications: AppNotification[];
  addNotification: (notification: AppNotification) => void;
  deleteNotification: (id: string) => void;

  // Acțiuni pentru robot
  callRobot: (sender: User) => void;                 // Pas 1: Expeditorul cheamă robotul
  confirmArrivalAtSender: () => void;                 // Pas 2: Expeditorul confirmă sosirea robotului la el
  startDelivery: (from: User, to: User) => void;      // Pas 3: Expeditorul încarcă foile și trimite la destinatar
  markArrived: () => void;                            // Pas 4: Robotul ajunge la destinatar
  confirmDelivery: () => void;                        // Pas 5: Destinatarul confirmă primirea (robotul devine liber)
  resetRobot: () => void;                             // Reset manual (în caz de eroare)
};

// Creăm store-ul cu valorile inițiale și acțiunile
export const useRobotStore = create<RobotStore>((set) => ({
  // Conexiune
  connectionStatus: 'connecting',
  lastMessage: null,
  setConnectionStatus: (status) => set({ connectionStatus: status }),
  setLastMessage: (data) => {
    set({ lastMessage: data });

    const type = data.type as string;
    const currentUser = useRobotStore.getState().currentUser;

    if (type === 'call_robot') {
      const sender = data.sender as User;
      if (sender) {
        set({
          robotStatus: 'coming_to_sender',
          currentDelivery: { from: sender, to: null, startedAt: Date.now() },
        });
      }
    } 
    else if (type === 'robot_arrived_sender') {
      set({ robotStatus: 'arrived_at_sender' });
    } 
    else if (type === 'start_delivery') {
      const from = data.from_user as User;
      const to = data.to_user as User;
      if (from && to) {
        const newNotif = {
          id: String(Date.now()),
          from,
          to,
          status: 'in_transit' as const,
          timestamp: Date.now(),
        };

        set((state) => ({
          robotStatus: 'in_transit',
          currentDelivery: { from, to, startedAt: Date.now() },
          notifications: [newNotif, ...state.notifications],
        }));
      }
    } 
    else if (type === 'robot_arrived_recipient') {
      set({ robotStatus: 'arrived' });
    } 
    else if (type === 'delivery_confirmed' || type === 'confirm_delivery') {
      set((state) => ({
        robotStatus: 'idle',
        currentDelivery: null,
        notifications: state.notifications.map((n) =>
          n.status === 'in_transit'
            ? { ...n, status: 'delivered' as const }
            : n
        ),
      }));
    }
    else if (type === 'reset_robot') {
      set({
        robotStatus: 'idle',
        currentDelivery: null,
      });
    }
  },

  // Utilizator
  currentUser: null,
  setCurrentUser: (user) => set({ currentUser: user }),

  // Robot — implicit liber
  robotStatus: 'idle',
  currentDelivery: null,

  // Notificări Inbox
  notifications: [],
  addNotification: (notification) =>
    set((state) => ({ notifications: [notification, ...state.notifications] })),
  deleteNotification: (id) =>
    set((state) => ({ notifications: state.notifications.filter((n) => n.id !== id) })),

  // Pas 1: Cheamă robotul (vine spre expeditor)
  callRobot: (sender) =>
    set({
      robotStatus: 'coming_to_sender',
      currentDelivery: { from: sender, to: null, startedAt: Date.now() },
    }),

  // Pas 2: Confirmă sosirea la expeditor (pregătit de selecție destinatar)
  confirmArrivalAtSender: () =>
    set({
      robotStatus: 'arrived_at_sender',
    }),

  // Pas 3: Pornește livrarea propriu-zisă spre destinatar
  startDelivery: (from, to) => {
    const newNotif: AppNotification = {
      id: String(Date.now()),
      from,
      to,
      status: 'in_transit',
      timestamp: Date.now(),
    };
    set((state) => ({
      robotStatus: 'in_transit',
      currentDelivery: { from, to, startedAt: Date.now() },
      notifications: [newNotif, ...state.notifications],
    }));
  },

  // Pas 4: Robotul a ajuns la destinatar
  markArrived: () => set({ robotStatus: 'arrived' }),

  // Pas 5: Destinatarul a confirmat primirea (robotul se întoarce la starea liberă)
  confirmDelivery: () =>
    set((state) => ({
      robotStatus: 'idle',
      currentDelivery: null,
      // Marcăm toate notificările active ca fiind livrate
      notifications: state.notifications.map((n) =>
        n.status === 'in_transit'
          ? { ...n, status: 'delivered' }
          : n
      ),
    })),

  // Reset manual (în caz de eroare)
  resetRobot: () =>
    set({
      robotStatus: 'idle',
      currentDelivery: null,
    }),
}));