// ポートフォリオ集計（純粋関数）
// localStorage のデータと市場データを組み合わせて評価額・内訳を計算する。

import type { AssetClass, MarketResult, MarketSource, QuoteData } from "./types";
import type { PortfolioData } from "./store";

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
  value: number;
  cost: number | null;
  gain: number | null;
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
  stockHoldings: ValuedHolding[];
  marketSources: MarketSource[];
};

export type QuoteLookup = (ticker: string, name?: string) => MarketResult<QuoteData>;

export function computePortfolio(data: PortfolioData, getQuote: QuoteLookup): Portfolio {
  const accountMap = new Map(data.accounts.map((a) => [a.id, a]));

  const valued: ValuedHolding[] = data.holdings.map((h) => {
    const account = accountMap.get(h.accountId);
    let value = 0;
    let quote: QuoteData | null = null;
    let quoteSource: MarketSource = "none";
    if (h.ticker && h.assetType === "stock") {
      const res = getQuote(h.ticker, h.name);
      quote = res.data;
      quoteSource = res.source;
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
      assetType: h.assetType,
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

  return {
    accounts: data.accounts,
    holdings: valued,
    total,
    totalCost,
    totalGain: total - totalCost,
    byClass,
    byAccount: data.accounts.map((a) => ({
      accountId: a.id,
      name: a.name,
      total: byAccountMap.get(a.id) ?? 0,
    })),
    stockHoldings: valued.filter((h) => h.ticker && h.assetType === "stock"),
    marketSources: Array.from(new Set(valued.map((v) => v.quoteSource).filter((s) => s !== "none"))),
  };
}

// 資産推移スナップショットの集計
export function snapshotSeries(
  data: PortfolioData,
): { date: string; total: number; byClass: Record<string, number> }[] {
  const byDate = new Map<string, Record<string, number>>();
  for (const r of data.snapshots) {
    const entry = byDate.get(r.date) ?? {};
    entry[r.category] = (entry[r.category] ?? 0) + r.amount;
    byDate.set(r.date, entry);
  }
  return Array.from(byDate.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, byClass]) => ({
      date,
      total: Object.values(byClass).reduce((a, b) => a + b, 0),
      byClass,
    }));
}
