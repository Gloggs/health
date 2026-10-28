import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';
import { requireDatabaseUrl } from '@/lib/env';

const sql = neon(requireDatabaseUrl());

export const db = drizzle(sql, { schema });
