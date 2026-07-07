// ポートフォリオ集計サービス（サーバー側）
// 口座・保有資産を読み、株式はYahoo Financeの株価で評価して合計・内訳を計算する。

import { asc } from "drizzle-orm";
import { db, accounts, holdings, assetSnapshots } from "@/db";
import { getQuotes } from "./yahoo";
import type { AssetClass, MarketSource, QuoteData } from "./types";
import { today } from "./format";

export type ValuedHolding = {
  id: number;
  accountId: number;
  accountName: string;
  assetType: AssetClass;
  ticker: string | null;
  name: string;
  quantity: number;
  avgCost: number | null;
  nisa: string;
  value: number; // 現在評価額（円）
  cost: number | null; // 取得コスト合計
  gain: number | null; // 評価損益
  gainPct: number | null;
  quote: QuoteData | null;
  quoteSource: MarketSource;
};

export type Portfolio = {
  accounts: { id: number; name: string; institution: string; type: string }[];
  holdings: ValuedHolding[];
  total: number;
  totalCost: number;
  totalGain: number;
  byClass: Partial<Record<AssetClass, number>>;
  byAccount: { accountId: number; name: string; total: number }[];
  stockHoldings: ValuedHolding[]; // ティッカー付き株式のみ
  marketSources: MarketSource[]; // 使用したデータソース（UI表示用）
};

export async function getPortfolio(): Promise<Portfolio> {
  const accountRows = db.select().from(accounts).orderBy(asc(accounts.id)).all();
  const holdingRows = db.select().from(holdings).orderBy(asc(holdings.id)).all();
  const accountMap = new Map(accountRows.map((a) => [a.id, a]));

  // 株価をまとめて取得（ティッカー付きの株式のみ）
  const tickers = Array.from(
    new Map(
      holdingRows
        .filter((h) => h.ticker && h.assetType === "stock")
        .map((h) => [h.ticker as string, { ticker: h.ticker as string, name: h.name }]),
    ).values(),
  );
  const quotes = await getQuotes(tickers);

  const valued: ValuedHolding[] = holdingRows.map((h) => {
    const account = accountMap.get(h.accountId);
    let value = 0;
    let quote: QuoteData | null = null;
    let quoteSource: MarketSource = "none";
    if (h.ticker && h.assetType === "stock") {
      const res = quotes.get(h.ticker);
      quote = res?.data ?? null;
      quoteSource = res?.source ?? "none";
      if (quote && quote.price > 0) {
        value = quote.price * h.quantity;
      } else {
        value = h.manualValue ?? (h.avgCost != null ? h.avgCost * h.quantity : 0);
      }
    } else {
      value = h.manualValue ?? (h.avgCost != null ? h.avgCost * h.quantity : h.quantity);
    }
    const cost = h.avgCost != null ? h.avgCost * h.quantity : null;
    const gain = cost != null ? value - cost : null;
    return {
      id: h.id,
      accountId: h.accountId,
      accountName: account?.name ?? "不明な口座",
      assetType: h.assetType as AssetClass,
      ticker: h.ticker,
      name: h.name,
      quantity: h.quantity,
      avgCost: h.avgCost,
      nisa: h.nisa,
      value,
      cost,
      gain,
      gainPct: gain != null && cost ? (gain / cost) * 100 : null,
      quote,
      quoteSource,
    };
  });

  const total = valued.reduce((s, h) => s + h.value, 0);
  const totalCost = valued.reduce((s, h) => s + (h.cost ?? h.value), 0);

  const byClass: Partial<Record<AssetClass, number>> = {};
  for (const h of valued) {
    byClass[h.assetType] = (byClass[h.assetType] ?? 0) + h.value;
  }

  const byAccountMap = new Map<number, number>();
  for (const h of valued) {
    byAccountMap.set(h.accountId, (byAccountMap.get(h.accountId) ?? 0) + h.value);
  }
  const byAccount = accountRows.map((a) => ({
    accountId: a.id,
    name: a.name,
    total: byAccountMap.get(a.id) ?? 0,
  }));

  return {
    accounts: accountRows,
    holdings: valued,
    total,
    totalCost,
    totalGain: total - totalCost,
    byClass,
    byAccount,
    stockHoldings: valued.filter((h) => h.ticker && h.assetType === "stock"),
    marketSources: Array.from(new Set(valued.map((v) => v.quoteSource).filter((s) => s !== "none"))),
  };
}

// 現在の保有からスナップショットを記録（同日・同カテゴリは上書き）
export function recordSnapshotFromPortfolio(byClass: Partial<Record<AssetClass, number>>): void {
  const date = today();
  for (const [category, amount] of Object.entries(byClass)) {
    if (amount == null) continue;
    db.insert(assetSnapshots)
      .values({ date, category, amount, source: "auto" })
      .onConflictDoUpdate({
        target: [assetSnapshots.date, assetSnapshots.category],
        set: { amount, source: "auto" },
      })
      .run();
  }
}

export function getSnapshotSeries(): { date: string; total: number; byClass: Record<string, number> }[] {
  const rows = db.select().from(assetSnapshots).orderBy(asc(assetSnapshots.date)).all();
  const byDate = new Map<string, Record<string, number>>();
  for (const r of rows) {
    const entry = byDate.get(r.date) ?? {};
    entry[r.category] = (entry[r.category] ?? 0) + r.amount;
    byDate.set(r.date, entry);
  }
  return Array.from(byDate.entries()).map(([date, byClass]) => ({
    date,
    total: Object.values(byClass).reduce((a, b) => a + b, 0),
    byClass,
  }));
}
