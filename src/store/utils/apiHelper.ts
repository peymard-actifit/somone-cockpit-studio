// SOMONE Cockpit Studio - Helper API centralisé
// Simplifie les appels API avec gestion automatique du token et des erreurs

import { useAuthStore } from '../authStore';

const API_URL = '/api';

export interface ApiOptions extends RequestInit {
  skipAuth?: boolean;
}

export interface ApiError extends Error {
  status: number;
  statusText: string;
  data?: any;
}

/**
 * Effectue un appel API avec gestion automatique du token
 */
export async function apiCall<T = any>(
  endpoint: string, 
  options: ApiOptions = {}
): Promise<T> {
  const { skipAuth = false, headers: customHeaders, ...restOptions } = options;
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...customHeaders,
  };
  
  if (!skipAuth) {
    const token = useAuthStore.getState().token;
    if (token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }
  }
  
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...restOptions,
    headers,
  });
  
  if (!response.ok) {
    const error = new Error(response.statusText) as ApiError;
    error.status = response.status;
    error.statusText = response.statusText;
    try {
      error.data = await response.json();
    } catch {
      // Pas de JSON dans la réponse
    }
    throw error;
  }
  
  // Pour les réponses vides (204 No Content)
  if (response.status === 204) {
    return undefined as T;
  }
  
  return response.json();
}

/**
 * GET request
 */
export function apiGet<T = any>(endpoint: string, options?: ApiOptions): Promise<T> {
  return apiCall<T>(endpoint, { ...options, method: 'GET' });
}

/**
 * POST request
 */
export function apiPost<T = any>(endpoint: string, data?: any, options?: ApiOptions): Promise<T> {
  return apiCall<T>(endpoint, { 
    ...options, 
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * PUT request
 */
export function apiPut<T = any>(endpoint: string, data?: any, options?: ApiOptions): Promise<T> {
  return apiCall<T>(endpoint, { 
    ...options, 
    method: 'PUT',
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * DELETE request
 */
export function apiDelete<T = any>(endpoint: string, options?: ApiOptions): Promise<T> {
  return apiCall<T>(endpoint, { ...options, method: 'DELETE' });
}

// Export de l'URL de base pour les cas spéciaux
export { API_URL };
