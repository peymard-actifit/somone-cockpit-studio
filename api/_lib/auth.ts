// SOMONE Cockpit Studio - Authentification
import type { VercelResponse } from '@vercel/node';
import { JWT_SECRET } from './config';
import type { User, CockpitData } from './types';

// Simple JWT implementation (compatible avec l'existant - utilise btoa)
export function createToken(payload: { id: string; isAdmin: boolean }): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify({ ...payload, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 }));
  const signature = btoa(JSON.stringify({ secret: JWT_SECRET, data: body }));
  return `${header}.${body}.${signature}`;
}

export function verifyToken(token: string): { id: string; isAdmin: boolean; exp?: number } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = JSON.parse(atob(parts[1]));
    
    // Vérifier l'expiration
    if (payload.exp && payload.exp < Date.now()) {
      return null;
    }
    
    return payload;
  } catch {
    return null;
  }
}

// Hash de mot de passe (compatible avec l'existant)
export function hashPassword(password: string): string {
  return btoa(password + JWT_SECRET);
}

export function comparePassword(password: string, hash: string): boolean {
  return btoa(password + JWT_SECRET) === hash;
}

// Vérification d'accès à un cockpit
export function canAccessCockpit(cockpit: CockpitData, user: User): boolean {
  if (user.isAdmin) return true;
  if (cockpit.userId === user.id) return true;
  if (cockpit.data?.sharedWith?.includes(user.id)) return true;
  return false;
}

// Headers CORS
export function setCorsHeaders(res: VercelResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
}

// Extraire et vérifier le token depuis les headers
export function getAuthUser(authHeader: string | undefined): { id: string; isAdmin: boolean } | null {
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.split(' ')[1];
  return verifyToken(token);
}
