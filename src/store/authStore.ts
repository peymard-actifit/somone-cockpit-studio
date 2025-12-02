import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  
  login: (username: string, password: string) => Promise<boolean>;
  register: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  changePassword: (oldPassword: string, newPassword: string) => Promise<boolean>;
  toggleAdmin: (code: string) => Promise<boolean>;
  clearError: () => void;
}

const API_URL = '/api';

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: false,
      error: null,

      login: async (username: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
          });
          
          const data = await response.json();
          
          if (!response.ok) {
            set({ error: data.error || 'Erreur de connexion', isLoading: false });
            return false;
          }
          
          set({ user: data.user, token: data.token, isLoading: false });
          return true;
        } catch (error) {
          set({ error: 'Erreur de connexion au serveur', isLoading: false });
          return false;
        }
      },

      register: async (username: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
          });
          
          const data = await response.json();
          
          if (!response.ok) {
            set({ error: data.error || 'Erreur lors de l\'inscription', isLoading: false });
            return false;
          }
          
          set({ user: data.user, token: data.token, isLoading: false });
          return true;
        } catch (error) {
          set({ error: 'Erreur de connexion au serveur', isLoading: false });
          return false;
        }
      },

      logout: () => {
        set({ user: null, token: null, error: null });
      },

      changePassword: async (oldPassword: string, newPassword: string) => {
        const { token } = get();
        set({ isLoading: true, error: null });
        
        try {
          const response = await fetch(`${API_URL}/auth/change-password`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ oldPassword, newPassword }),
          });
          
          const data = await response.json();
          
          if (!response.ok) {
            set({ error: data.error || 'Erreur lors du changement de mot de passe', isLoading: false });
            return false;
          }
          
          set({ isLoading: false });
          return true;
        } catch (error) {
          set({ error: 'Erreur de connexion au serveur', isLoading: false });
          return false;
        }
      },

      toggleAdmin: async (code: string) => {
        const { token, user } = get();
        set({ isLoading: true, error: null });
        
        try {
          const response = await fetch(`${API_URL}/auth/toggle-admin`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ code }),
          });
          
          const data = await response.json();
          
          if (!response.ok) {
            set({ error: data.error || 'Code invalide', isLoading: false });
            return false;
          }
          
          if (user) {
            set({ 
              user: { ...user, isAdmin: data.isAdmin },
              isLoading: false 
            });
          }
          return true;
        } catch (error) {
          set({ error: 'Erreur de connexion au serveur', isLoading: false });
          return false;
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'cockpit-auth',
      partialize: (state) => ({ user: state.user, token: state.token }),
    }
  )
);





