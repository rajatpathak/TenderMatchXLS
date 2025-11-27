import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import { Pool as PgPool } from 'pg';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import ws from "ws";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const databaseUrl = process.env.DATABASE_URL;
const isNeonDatabase = databaseUrl.includes('neon.tech') || databaseUrl.includes('neon.cloud');

let pool: NeonPool | PgPool;
let db: ReturnType<typeof drizzleNeon> | ReturnType<typeof drizzlePg>;

if (isNeonDatabase) {
  // Use Neon serverless driver for Neon databases
  neonConfig.webSocketConstructor = ws;
  pool = new NeonPool({ connectionString: databaseUrl });
  db = drizzleNeon({ client: pool as NeonPool, schema });
  console.log("📦 Using Neon serverless database driver");
} else {
  // Use standard pg driver for local/other PostgreSQL
  pool = new PgPool({ 
    connectionString: databaseUrl,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
  });
  db = drizzlePg({ client: pool as PgPool, schema });
  console.log("📦 Using standard PostgreSQL driver (SSL: " + (process.env.DATABASE_SSL === 'true') + ")");
}

export { pool, db };
