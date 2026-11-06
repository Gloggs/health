import { neon, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';
import { requireDatabaseUrl } from '@/lib/env';

// Tests point the driver at a local stand-in for Neon's SQL endpoint (docs/TESTING.md). Never set in production.
if (process.env.NEON_LOCAL_SQL_URL) neonConfig.fetchEndpoint = process.env.NEON_LOCAL_SQL_URL;

const sql = neon(requireDatabaseUrl());

export const db = drizzle(sql, { schema });
