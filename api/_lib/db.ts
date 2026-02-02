// SOMONE Cockpit Studio - Accès Base de Données
import { Redis } from '@upstash/redis';
import { neon } from '@neondatabase/serverless';
import type { Database } from './types';
import { log } from './config';

// ============================================
// Redis (données de travail)
// ============================================

const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '';
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';

export const redis = new Redis({
  url: redisUrl,
  token: redisToken,
});

const DB_KEY = 'somone-cockpit-db';

// Récupérer la base de données
export async function getDb(): Promise<Database> {
  try {
    const data = await redis.get<Database>(DB_KEY);
    if (data) {
      return {
        ...data,
        folders: data.folders || [],
        contextualHelps: data.contextualHelps || [],
        passwordResetTokens: data.passwordResetTokens || [],
        journeySteps: data.journeySteps || [],
        journeys: data.journeys || [],
      };
    }
  } catch (error) {
    log.error('[Redis] Erreur lecture:', error);
  }
  
  return {
    users: [],
    cockpits: [],
    folders: [],
    contextualHelps: [],
    passwordResetTokens: [],
    journeySteps: [],
    journeys: [],
  };
}

// Sauvegarder la base de données
export async function saveDb(db: Database): Promise<boolean> {
  try {
    await redis.set(DB_KEY, db);
    return true;
  } catch (error) {
    log.error('[Redis] Erreur sauvegarde:', error);
    return false;
  }
}

// ============================================
// PostgreSQL (snapshots publiés)
// ============================================

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
export const sql = databaseUrl ? neon(databaseUrl) : null;

let pgInitialized = false;

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
    console.log('[PostgreSQL] Table initialisée');
    return true;
  } catch (error: any) {
    console.error('[PostgreSQL] Erreur init:', error?.message);
    return false;
  }
}

export async function saveSnapshot(
  cockpitId: string, 
  publicId: string, 
  name: string, 
  snapshotData: any, 
  version: number
): Promise<boolean> {
  if (!sql) return false;
  await initPostgres();
  
  try {
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
    return true;
  } catch (error: any) {
    console.error('[PostgreSQL] Erreur save:', error?.message);
    return false;
  }
}

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
    console.error('[PostgreSQL] Erreur load:', error?.message);
    return null;
  }
}

export async function deleteSnapshot(publicId: string): Promise<boolean> {
  if (!sql) return false;
  await initPostgres();
  
  try {
    await sql`DELETE FROM published_cockpits WHERE public_id = ${publicId}`;
    return true;
  } catch (error: any) {
    console.error('[PostgreSQL] Erreur delete:', error?.message);
    return false;
  }
}
