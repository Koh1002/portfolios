// 市場データ取得層
// Yahoo Finance（yahoo-finance2）から株価・財務データを取得し SQLite にキャッシュする。
// 取得優先順位: 新鮮なキャッシュ → ライブ取得 → 古いキャッシュ → サンプルデータ(mock)
// 環境変数 MARKET_DATA=mock でライブ取得を無効化できる（デモ・オフライン用）。

import YahooFinance from "yahoo-finance2";
import { eq } from "drizzle-orm";
import { db, marketCache } from "@/db";
import type { Fundamentals, MarketResult, QuoteData } from "./types";
import { generateMockMarket } from "@/data/mock-market";

const QUOTE_TTL_MS = 15 * 60 * 1000; // 株価: 15分
const FUNDAMENTALS_TTL_MS = 24 * 60 * 60 * 1000; // 財務: 24時間

const MOCK_ONLY = process.env.MARKET_DATA === "mock";

declare global {
  var __yahooClient: InstanceType<typeof YahooFinance> | undefined;
}

function yahoo() {
  return (globalThis.__yahooClient ??= new YahooFinance({
    suppressNotices: ["yahooSurvey", "ripHistorical"],
  }));
}

// 「7203」→「7203.T」。既にサフィックスやアルファベットを含む場合はそのまま。
export function toYahooSymbol(ticker: string): string {
  const t = ticker.trim().toUpperCase();
  if (/^\d{4}[A-Z]?$/.test(t)) return `${t}.T`;
  return t;
}

function cacheKey(kind: string, ticker: string): string {
  return `${kind}:${ticker}`;
}

function readCache(key: string): { json: string; fetchedAt: number } | null {
  const row = db.select().from(marketCache).where(eq(marketCache.key, key)).get();
  return row ? { json: row.json, fetchedAt: row.fetchedAt } : null;
}

function writeCache(key: string, data: unknown): void {
  db.insert(marketCache)
    .values({ key, json: JSON.stringify(data), fetchedAt: Date.now() })
    .onConflictDoUpdate({
      target: marketCache.key,
      set: { json: JSON.stringify(data), fetchedAt: Date.now() },
    })
    .run();
}

async function withFallback<T>(
  kind: string,
  ticker: string,
  ttl: number,
  fetchLive: () => Promise<T>,
  mock: () => T,
): Promise<MarketResult<T>> {
  const key = cacheKey(kind, ticker);
  const cached = readCache(key);
  if (cached && Date.now() - cached.fetchedAt < ttl) {
    return { data: JSON.parse(cached.json) as T, source: "cache", fetchedAt: cached.fetchedAt };
  }
  if (!MOCK_ONLY) {
    try {
      const live = await fetchLive();
      writeCache(key, live);
      return { data: live, source: "live", fetchedAt: Date.now() };
    } catch {
      // ライブ取得失敗 → 古いキャッシュがあればそれを使う
      if (cached) {
        return { data: JSON.parse(cached.json) as T, source: "cache", fetchedAt: cached.fetchedAt };
      }
    }
  }
  return { data: mock(), source: "mock" };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapQuote(ticker: string, q: any): QuoteData {
  return {
    ticker,
    name: q.shortName ?? q.longName ?? ticker,
    price: q.regularMarketPrice ?? 0,
    currency: q.currency ?? "JPY",
    previousClose: q.regularMarketPreviousClose,
    changePercent: q.regularMarketChangePercent,
    fiftyTwoWeekLow: q.fiftyTwoWeekLow,
    fiftyTwoWeekHigh: q.fiftyTwoWeekHigh,
    marketCap: q.marketCap,
    trailingPE: q.trailingPE,
    forwardPE: q.forwardPE,
    epsTrailing: q.epsTrailingTwelveMonths,
    epsForward: q.epsForward,
    priceToBook: q.priceToBook,
    bookValue: q.bookValue,
    dividendRate: q.dividendRate ?? q.trailingAnnualDividendRate,
    dividendYieldPct:
      q.dividendYield ??
      (q.trailingAnnualDividendYield != null ? q.trailingAnnualDividendYield * 100 : undefined),
    sharesOutstanding: q.sharesOutstanding,
  };
}

function mapFundamentals(ticker: string, qs: any): Fundamentals {
  const fin = qs.financialData ?? {};
  const sd = qs.summaryDetail ?? {};
  const cfStatements: any[] = qs.cashflowStatementHistory?.cashflowStatements ?? [];
  const isStatements: any[] = qs.incomeStatementHistory?.incomeStatementHistory ?? [];
  const quarterly: any[] = qs.earnings?.financialsChart?.quarterly ?? [];
  const earningsDates: Date[] = qs.calendarEvents?.earnings?.earningsDate ?? [];

  const fcfHistory = cfStatements
    .map((c) => {
      const year = c.endDate ? new Date(c.endDate).getFullYear() : undefined;
      const ocf = c.totalCashFromOperatingActivities;
      const capex = c.capitalExpenditures != null ? Math.abs(c.capitalExpenditures) : undefined;
      const fcf = ocf != null && capex != null ? ocf - capex : undefined;
      return year ? { year, ocf, capex, fcf } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x != null)
    .sort((a, b) => a.year - b.year);

  const annualResults = isStatements
    .map((s) => {
      const year = s.endDate ? new Date(s.endDate).getFullYear() : undefined;
      return year ? { year, revenue: s.totalRevenue, netIncome: s.netIncome } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x != null)
    .sort((a, b) => a.year - b.year);

  return {
    ticker,
    payoutRatio: sd.payoutRatio,
    operatingCashflow: fin.operatingCashflow,
    freeCashflow: fin.freeCashflow,
    totalDebt: fin.totalDebt,
    totalCash: fin.totalCash,
    earningsGrowth: fin.earningsGrowth,
    revenueGrowth: fin.revenueGrowth,
    fcfHistory,
    annualResults,
    quarterlyResults: quarterly.map((q) => ({
      label: String(q.date),
      revenue: q.revenue,
      earnings: q.earnings,
    })),
    nextEarningsDate: earningsDates[0] ? new Date(earningsDates[0]).toISOString().slice(0, 10) : undefined,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function getQuote(ticker: string, name?: string): Promise<MarketResult<QuoteData>> {
  const code = ticker.trim();
  return withFallback(
    "quote",
    code,
    QUOTE_TTL_MS,
    async () => mapQuote(code, await yahoo().quote(toYahooSymbol(code))),
    () => generateMockMarket(code, name).quote,
  );
}

export async function getQuotes(
  tickers: { ticker: string; name?: string }[],
): Promise<Map<string, MarketResult<QuoteData>>> {
  const results = await Promise.all(tickers.map((t) => getQuote(t.ticker, t.name)));
  const map = new Map<string, MarketResult<QuoteData>>();
  tickers.forEach((t, i) => map.set(t.ticker, results[i]));
  return map;
}

export async function getFundamentals(
  ticker: string,
  name?: string,
): Promise<MarketResult<Fundamentals>> {
  const code = ticker.trim();
  return withFallback(
    "fundamentals",
    code,
    FUNDAMENTALS_TTL_MS,
    async () => {
      const qs = await yahoo().quoteSummary(toYahooSymbol(code), {
        modules: [
          "financialData",
          "summaryDetail",
          "defaultKeyStatistics",
          "cashflowStatementHistory",
          "incomeStatementHistory",
          "earnings",
          "calendarEvents",
        ],
      });
      return mapFundamentals(code, qs);
    },
    () => generateMockMarket(code, name).fundamentals,
  );
}

export const MARKET_SOURCE_LABEL: Record<string, string> = {
  live: "リアルタイム",
  cache: "キャッシュ",
  mock: "サンプルデータ",
  none: "取得不可",
};
