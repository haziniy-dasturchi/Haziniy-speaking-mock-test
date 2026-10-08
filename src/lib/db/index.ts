import * as schema from "./schema";

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("dotenv").config();
} catch {}

const databaseUrl = process.env.DATABASE_URL || "";
const isNeonConfigured =
  databaseUrl.startsWith("postgres") &&
  !databaseUrl.includes("ep-sample-pooler") &&
  !databaseUrl.includes("npg_test");

let dbInstance: any;

if (isNeonConfigured) {
  // Neon Serverless HTTP driver for Cloudflare Workers & Production
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { neon } = require("@neondatabase/serverless");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require("drizzle-orm/neon-http");
  const sql = neon(databaseUrl);
  dbInstance = drizzle(sql, { schema });
} else {
  // Local zero-setup PGlite (100% in-process PostgreSQL without external accounts)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require("path");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require("fs");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PGlite } = require("@electric-sql/pglite");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require("drizzle-orm/pglite");

  const dataDir = path.join(process.cwd(), "data", "pgdata");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const globalForDb = global as unknown as {
    pgliteInstance?: any;
    drizzleDbInstance?: any;
  };

  if (!globalForDb.pgliteInstance) {
    globalForDb.pgliteInstance = new PGlite(dataDir);
    globalForDb.drizzleDbInstance = drizzle(globalForDb.pgliteInstance, { schema });
  }

  dbInstance = globalForDb.drizzleDbInstance;
}

export const db = dbInstance;
export { schema };
