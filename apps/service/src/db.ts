import { readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import type { AppConfig } from "./config.js";

const { Pool } = pg;

export function createPool(config: AppConfig): pg.Pool {
  return new Pool({
    connectionString: config.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
}

export async function migrate(pool: pg.Pool, workspaceId: string): Promise<void> {
  const migration = await readFile(
    path.resolve(process.cwd(), "migrations", "001-initial.sql"),
    "utf8",
  );
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(migration);
    await client.query(
      "INSERT INTO reviewer_workspaces (id) VALUES ($1) ON CONFLICT (id) DO NOTHING",
      [workspaceId],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export type Database = pg.Pool;
