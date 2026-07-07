import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

// 金融機関口座（マネーフォワードME/SBI証券/楽天証券/銀行 など）
export const accounts = sqliteTable("accounts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  institution: text("institution").notNull().default(""),
  // bank | securities | cash | pension | point | other
  type: text("type").notNull().default("other"),
  createdAt: text("created_at").notNull().default(""),
});

// 保有資産（個別株・投信・現金・債券など）
export const holdings = sqliteTable("holdings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  accountId: integer("account_id").notNull(),
  // stock | fund | bond | cash | crypto | pension | point | other
  assetType: text("asset_type").notNull().default("stock"),
  // 日本株は証券コード4桁（例: 7203）。米国株はティッカーそのまま。
  ticker: text("ticker"),
  name: text("name").notNull(),
  quantity: real("quantity").notNull().default(0),
  // 1単位あたりの平均取得単価（円）
  avgCost: real("avg_cost"),
  // ティッカーの無い資産（投信・現金等）の現在評価額（円）
  manualValue: real("manual_value"),
  // none | tsumitate | growth | general
  nisa: text("nisa").notNull().default("none"),
  updatedAt: text("updated_at").notNull().default(""),
});

// 資産スナップショット（資産推移グラフ用）
export const assetSnapshots = sqliteTable("asset_snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull(), // YYYY-MM-DD
  category: text("category").notNull(), // 資産クラス
  amount: real("amount").notNull(),
  source: text("source").notNull().default("manual"), // manual | import | auto
});

// 収支明細（マネーフォワード家計簿CSV由来）
export const transactions = sqliteTable("transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull(),
  amount: real("amount").notNull(), // 収入は正、支出は負
  category: text("category").notNull().default("未分類"),
  subCategory: text("sub_category").notNull().default(""),
  description: text("description").notNull().default(""),
  institution: text("institution").notNull().default(""),
});

// 市場データキャッシュ（Yahoo Financeレスポンス）
export const marketCache = sqliteTable("market_cache", {
  key: text("key").primaryKey(), // `${kind}:${ticker}`
  json: text("json").notNull(),
  fetchedAt: integer("fetched_at").notNull(), // epoch ms
});

// アプリ設定（目標アロケーション・DCFパラメータ等）
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  json: text("json").notNull(),
});
