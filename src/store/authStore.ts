import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, UserType } from '../types';

// Type pour un utilisateur dans la liste (sans mot de passe)
export interface UserListItem {
  id: string;
  username: string;
  name?: string;
  email?: string;
  isAdmin: boolean;
  userType: UserType;
  canBecomeAdmin?: boolean;
  createdAt: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  
  login: (username: string, password: string) => Promise<boolean>;
  register: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  changePassword: (oldPassword: string, newPassword: string) => Promise<boolean>;
  changeName: (name: string) => Promise<boolean>;
  changeEmail: (email: string) => Promise<boolean>;
  toggleAdmin: (code: string) => Promise<boolean>;
  clearError: () => void;
  
  // Gestion des utilisateurs (admin uniquement)
  fetchUsers: () => Promise<UserListItem[]>;
  createUser: (data: { username: string; password: string; name?: string; email?: string; userType: UserType; canBecomeAdmin?: boolean }) => Promise<UserListItem | null>;
  updateUser: (userId: string, data: { username?: string; password?: string; name?: string; email?: string; userType?: UserType; canBecomeAdmin?: boolean }) => Promise<UserListItem | null>;
  deleteUser: (userId: string) => Promise<boolean>;
  generateResetToken: (userId: string) => Promise<{ token: string; url: string; expiresAt: string } | null>;
  
  // Helpers
  isClient: () => boolean;
  isStandard: () => boolean;
  canAccessAdminToggle: () => boolean;
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
            set({ error: data.error || 'Erreur lors de l inscription', isLoading: false });
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

      changeName: async (name: string) => {
        const { token, user } = get();
        set({ isLoading: true, error: null });
        try {
          const response = await fetch(`${API_URL}/auth/change-name`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ name }),
          });
          const data = await response.json();
          if (!response.ok) {
            set({ error: data.error || 'Erreur lors du changement de nom', isLoading: false });
            return false;
          }
          if (user) {
            set({ user: { ...user, name: data.name }, isLoading: false });
          }
          return true;
        } catch (error) {
          set({ error: 'Erreur de connexion au serveur', isLoading: false });
          return false;
        }
      },

      changeEmail: async (email: string) => {
        const { token, user } = get();
        set({ isLoading: true, error: null });
        try {
          const response = await fetch(`${API_URL}/auth/change-email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ email }),
          });
          const data = await response.json();
          if (!response.ok) {
            set({ error: data.error || 'Erreur lors du changement email', isLoading: false });
            return false;
          }
          if (user) {
            set({ user: { ...user, username: data.username }, isLoading: false });
          }
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
              user: { 
                ...user, 
                isAdmin: data.isAdmin,
                userType: data.userType || (data.isAdmin ? 'admin' : user.userType)
              }, 
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
      
      // Gestion des utilisateurs (admin uniquement)
      fetchUsers: async () => {
        const { token } = get();
        try {
          const response = await fetch(`${API_URL}/users`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
          const data = await response.json();
          if (!response.ok) {
            console.error('Erreur fetchUsers:', data.error);
            return [];
          }
          return data.users || [];
        } catch (error) {
          console.error('Erreur fetchUsers:', error);
          return [];
        }
      },

      createUser: async (userData) => {
        const { token } = get();
        set({ isLoading: true, error: null });
        try {
          const response = await fetch(`${API_URL}/users`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(userData),
          });
          const data = await response.json();
          set({ isLoading: false });
          if (!response.ok) {
            set({ error: data.error || 'Erreur lors de la création' });
            return null;
          }
          return data.user;
        } catch (error) {
          set({ error: 'Erreur de connexion au serveur', isLoading: false });
          return null;
        }
      },

      updateUser: async (userId, userData) => {
        const { token } = get();
        set({ isLoading: true, error: null });
        try {
          const response = await fetch(`${API_URL}/users/${userId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(userData),
          });
          const data = await response.json();
          set({ isLoading: false });
          if (!response.ok) {
            set({ error: data.error || 'Erreur lors de la modification' });
            return null;
          }
          return data.user;
        } catch (error) {
          set({ error: 'Erreur de connexion au serveur', isLoading: false });
          return null;
        }
      },

      deleteUser: async (userId) => {
        const { token } = get();
        set({ isLoading: true, error: null });
        try {
          const response = await fetch(`${API_URL}/users/${userId}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
          const data = await response.json();
          set({ isLoading: false });
          if (!response.ok) {
            set({ error: data.error || 'Erreur lors de la suppression' });
            return false;
          }
          return true;
        } catch (error) {
          set({ error: 'Erreur de connexion au serveur', isLoading: false });
          return false;
        }
      },

      generateResetToken: async (userId) => {
        const { token } = get();
        try {
          const response = await fetch(`${API_URL}/users/${userId}/reset-token`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
          const data = await response.json();
          if (!response.ok) {
            console.error('Erreur generateResetToken:', data.error);
            return null;
          }
          return {
            token: data.token,
            url: data.url,
            expiresAt: data.expiresAt
          };
        } catch (error) {
          console.error('Erreur generateResetToken:', error);
          return null;
        }
      },

      // Helpers
      isClient: () => {
        const { user } = get();
        return user?.userType === 'client';
      },

      isStandard: () => {
        const { user } = get();
        return user?.userType === 'standard';
      },

      canAccessAdminToggle: () => {
        const { user } = get();
        if (!user) return false;
        if (user.isAdmin) return true; // Les admins peuvent quitter le mode admin
        if (user.userType === 'client') return false; // Les clients ne peuvent jamais
        if (user.userType === 'standard' && user.canBecomeAdmin === false) return false;
        return true; // Les standards avec canBecomeAdmin !== false peuvent
      },
    }),
    {
      name: 'cockpit-auth',
      partialize: (state) => ({ user: state.user, token: state.token }),
    }
  )
);
