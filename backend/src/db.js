import sql from "mssql";
import { config } from "./config.js";

// One shared pool for the whole process. This is the main latency win over
// Power Automate: connections stay open and are reused, instead of every
// request paying for a new flow run + connector hop through the VPN.
let poolPromise = null;

export function getPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(config.db)
      .connect()
      .then((pool) => {
        pool.on("error", (err) => console.error("SQL pool error:", err.message));
        console.log(`Connected to SQL Server ${config.db.server}/${config.db.database}`);
        return pool;
      })
      .catch((err) => {
        poolPromise = null; // let the next request retry instead of caching the failure
        throw err;
      });
  }
  return poolPromise;
}

/**
 * Run one parameterised statement and return its recordset.
 * params: [{ name, type, value }] — always parameters, never string-built values.
 */
async function realQuery(text, params = []) {
  const pool = await getPool();
  const request = pool.request();
  for (const p of params) request.input(p.name, p.type, p.value);
  const result = await request.query(text);
  return result.recordset ?? [];
}

let impl = realQuery;
export const query = (text, params) => impl(text, params);

// Tests swap this out so the SQL we generate can be checked without a database.
export function __setQueryImpl(fn) {
  impl = fn || realQuery;
}

export async function ping() {
  await query("SELECT 1 AS ok");
  return true;
}

export async function closePool() {
  if (poolPromise) {
    const pool = await poolPromise.catch(() => null);
    poolPromise = null;
    if (pool) await pool.close();
  }
}

export { sql };
