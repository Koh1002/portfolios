import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

const DATA_DIR = process.env.PORTFOLIO_DATA_DIR ?? path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "portfolio.db");

const DDL = `
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  institution TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'other',
  created_at TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS holdings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL,
  asset_type TEXT NOT NULL DEFAULT 'stock',
  ticker TEXT,
  name TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 0,
  avg_cost REAL,
  manual_value REAL,
  nisa TEXT NOT NULL DEFAULT 'none',
  updated_at TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS asset_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  category TEXT NOT NULL,
  amount REAL NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual'
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_snapshots_date_cat ON asset_snapshots(date, category);
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  amount REAL NOT NULL,
  category TEXT NOT NULL DEFAULT '未分類',
  sub_category TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  institution TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS market_cache (
  key TEXT PRIMARY KEY,
  json TEXT NOT NULL,
  fetched_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  json TEXT NOT NULL
);
`;

declare global {
  var __portfolioDb: ReturnType<typeof createDb> | undefined;
}

function createDb() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.exec(DDL);
  return drizzle(sqlite, { schema });
}

// Next.js dev ではモジュールが何度も評価されるため globalThis に保持する
export const db = globalThis.__portfolioDb ?? (globalThis.__portfolioDb = createDb());

export * from "./schema";
