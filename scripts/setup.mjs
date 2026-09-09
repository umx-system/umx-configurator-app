/* eslint-env node */
import { closeSync, existsSync, mkdirSync, openSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

if (existsSync(".env")) process.loadEnvFile(".env");
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl?.startsWith("file:"))
  throw new Error("Set DATABASE_URL to a SQLite file URL before setup.");
const database = path.resolve("prisma", databaseUrl.slice(5));
mkdirSync(path.dirname(database), { recursive: true, mode: 0o700 });
// Some SQLite schema-engine builds cannot initialize a nonexistent file.
// Exclusive creation ensures setup never truncates an existing session store.
try {
  closeSync(openSync(database, "wx", 0o600));
} catch (error) {
  if (error.code !== "EEXIST") throw error;
}
for (const command of [["generate"], ["migrate", "deploy"]]) {
  execFileSync(
    process.execPath,
    ["node_modules/prisma/build/index.js", ...command],
    { stdio: "inherit" },
  );
}
