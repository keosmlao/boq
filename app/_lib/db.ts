import { Pool } from "pg";

const globalForPg = globalThis;

function getPoolConfig() {
  return {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    max: Number(process.env.DB_POOL_MAX || 20),
    idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS || 30_000),
    // Cap how long the pool will wait for a free connection before erroring;
    // surfaces saturation early instead of hanging the request.
    connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT_MS || 5_000),
    // Send TCP keepalives so dropped connections fail fast on idle pages.
    keepAlive: true,
  };
}

export const pool =
  globalForPg.__odgPool ||
  new Pool({
    ...getPoolConfig(),
  });

if (process.env.NODE_ENV !== "production") {
  globalForPg.__odgPool = pool;
}

export async function query(text, params = []) {
  return pool.query(text, params);
}

export async function withTransaction(work) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
