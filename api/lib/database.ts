// SOMONE Cockpit Studio - Connexions Base de Données
// Refactoring: Extraction des fonctions DB depuis api/index.ts

import { Redis } from '@upstash/redis';
import { neon, NeonQueryFunction } from '@neondatabase/serverless';
import type { Database } from './types';
import { log } from './config';

// Upstash Redis client (pour les données de travail)
const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '';
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';

// Logs de configuration uniquement en dev
if (process.env.NODE_ENV !== 'production') {
  console.log('Redis URL configured:', redisUrl ? 'YES' : 'NO');
  console.log('Redis Token configured:', redisToken ? 'YES' : 'NO');
}

export const redis = new Redis({
  url: redisUrl,
  token: redisToken,
});

// Neon PostgreSQL client (pour les snapshots publiés)
const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
if (process.env.NODE_ENV !== 'production') {
  console.log('PostgreSQL URL configured:', databaseUrl ? 'YES' : 'NO');
}

export const sql: NeonQueryFunction<false, false> | null = databaseUrl ? neon(databaseUrl) : null;

// État d'initialisation PostgreSQL
let pgInitialized = false;

/**
 * Initialiser la table des snapshots si elle n'existe pas
 */
export async function initPostgres(): Promise<boolean> {
  if (!sql || pgInitialized) return !!sql;
  
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS published_cockpits (
        id SERIAL PRIMARY KEY,
        cockpit_id VARCHAR(50) NOT NULL,
        public_id VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        snapshot_data JSONB NOT NULL,
        snapshot_version INTEGER DEFAULT 1,
        published_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_published_cockpits_public_id ON published_cockpits(public_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_published_cockpits_cockpit_id ON published_cockpits(cockpit_id)`;
    pgInitialized = true;
    console.log('[PostgreSQL] Table published_cockpits initialisee');
    return true;
  } catch (error: any) {
    console.error('[PostgreSQL] Erreur initialisation:', error?.message);
    return false;
  }
}

/**
 * Sauvegarder un snapshot dans PostgreSQL
 */
export async function saveSnapshot(
  cockpitId: string, 
  publicId: string, 
  name: string, 
  snapshotData: any, 
  version: number
): Promise<boolean> {
  if (!sql) {
    console.error('[PostgreSQL] Non configure');
    return false;
  }
  
  await initPostgres();
  
  try {
    // Upsert: update si existe, sinon insert
    await sql`
      INSERT INTO published_cockpits (cockpit_id, public_id, name, snapshot_data, snapshot_version, published_at, updated_at)
      VALUES (${cockpitId}, ${publicId}, ${name}, ${JSON.stringify(snapshotData)}, ${version}, NOW(), NOW())
      ON CONFLICT (public_id) 
      DO UPDATE SET 
        name = ${name},
        snapshot_data = ${JSON.stringify(snapshotData)},
        snapshot_version = ${version},
        published_at = NOW(),
        updated_at = NOW()
    `;
    console.log(`[PostgreSQL] Snapshot sauvegarde: ${name} (v${version})`);
    return true;
  } catch (error: any) {
    console.error('[PostgreSQL] Erreur sauvegarde snapshot:', error?.message);
    return false;
  }
}

/**
 * Charger un snapshot depuis PostgreSQL
 */
export async function loadSnapshot(publicId: string): Promise<any | null> {
  if (!sql) return null;
  
  await initPostgres();
  
  try {
    const result = await sql`
      SELECT cockpit_id, public_id, name, snapshot_data, snapshot_version, published_at
      FROM published_cockpits 
      WHERE public_id = ${publicId}
    `;
    
    if (result.length > 0) {
      const row = result[0];
      console.log(`[PostgreSQL] Snapshot charge: ${row.name} (v${row.snapshot_version})`);
      return {
        cockpitId: row.cockpit_id,
        publicId: row.public_id,
        name: row.name,
        ...row.snapshot_data,
        snapshotVersion: row.snapshot_version,
        snapshotCreatedAt: row.published_at
      };
    }
    return null;
  } catch (error: any) {
    console.error('[PostgreSQL] Erreur chargement snapshot:', error?.message);
    return null;
  }
}

/**
 * Supprimer un snapshot de PostgreSQL
 */
export async function deleteSnapshot(publicId: string): Promise<boolean> {
  if (!sql) return false;
  
  await initPostgres();
  
  try {
    await sql`DELETE FROM published_cockpits WHERE public_id = ${publicId}`;
    console.log(`[PostgreSQL] Snapshot supprime: ${publicId}`);
    return true;
  } catch (error: any) {
    console.error('[PostgreSQL] Erreur suppression snapshot:', error?.message);
    return false;
  }
}

// Clé Redis pour la base de données
const REDIS_DB_KEY = 'cockpit-studio:db';

/**
 * Obtenir la base de données depuis Redis
 */
export async function getDb(): Promise<Database> {
  try {
    const data = await redis.get<Database>(REDIS_DB_KEY);
    if (data) {
      return data;
    }
  } catch (error) {
    log.error('[Redis] Erreur lecture DB:', error);
  }
  
  // Base de données par défaut
  return {
    users: [],
    cockpits: [],
    folders: [],
    contextualHelps: [],
    journeySteps: [],
    journeys: [],
  };
}

/**
 * Sauvegarder la base de données dans Redis
 */
export async function saveDb(db: Database): Promise<boolean> {
  try {
    await redis.set(REDIS_DB_KEY, db);
    return true;
  } catch (error) {
    log.error('[Redis] Erreur sauvegarde DB:', error);
    return false;
  }
}
