// SOMONE Cockpit Studio - Authentification
// Refactoring: Extraction des fonctions auth depuis api/index.ts

import type { VercelResponse } from '@vercel/node';
import type { User, CockpitData } from './types';
import { JWT_SECRET } from './config';

// Simple JWT implementation (pas de lib externe pour Vercel)
const base64url = (str: string) => Buffer.from(str).toString('base64url');
const base64urlDecode = (str: string) => Buffer.from(str, 'base64url').toString();

/**
 * Créer un token JWT
 */
export function createToken(payload: { id: string; isAdmin: boolean }): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const data = { ...payload, iat: now, exp: now + 7 * 24 * 60 * 60 }; // 7 jours
  
  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(data));
  const signature = base64url(
    require('crypto')
      .createHmac('sha256', JWT_SECRET)
      .update(`${headerB64}.${payloadB64}`)
      .digest()
  );
  
  return `${headerB64}.${payloadB64}.${signature}`;
}

/**
 * Vérifier un token JWT (version simple)
 */
export function verifyTokenSimple(token: string): any | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const [headerB64, payloadB64, signatureB64] = parts;
    
    // Vérifier la signature
    const expectedSignature = base64url(
      require('crypto')
        .createHmac('sha256', JWT_SECRET)
        .update(`${headerB64}.${payloadB64}`)
        .digest()
    );
    
    if (signatureB64 !== expectedSignature) return null;
    
    const payload = JSON.parse(base64urlDecode(payloadB64));
    
    // Vérifier l'expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    
    return payload;
  } catch {
    return null;
  }
}

/**
 * Vérifier un token JWT (avec support des deux formats)
 */
export function verifyToken(token: string): { id: string; isAdmin: boolean; exp?: number } | null {
  return verifyTokenSimple(token);
}

/**
 * Hash un mot de passe (SHA256 simple pour compatibilité)
 */
export function hashPassword(password: string): string {
  return require('crypto').createHash('sha256').update(password).digest('hex');
}

/**
 * Comparer un mot de passe avec son hash
 */
export function comparePassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

/**
 * Vérification d'accès à un cockpit (propriétaire, admin, ou partagé avec)
 */
export function canAccessCockpit(cockpit: CockpitData, user: User): boolean {
  if (user.isAdmin) return true;
  if (cockpit.userId === user.id) return true;
  // Vérifier si le cockpit est partagé avec cet utilisateur
  if (cockpit.data?.sharedWith && Array.isArray(cockpit.data.sharedWith) && cockpit.data.sharedWith.includes(user.id)) {
    return true;
  }
  return false;
}

/**
 * Définir les headers CORS
 */
export function setCorsHeaders(res: VercelResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition'); // Permet au client de lire le nom du fichier
}
