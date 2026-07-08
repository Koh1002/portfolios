// Yahoo Finance レスポンス → アプリの型へのマッピング
// GitHub Actions の市場データ取得スクリプト（scripts/fetch-market-data.ts）から使用。

import type { Fundamentals, QuoteData } from "./types";

// 「7203」→「7203.T」。既にサフィックスやアルファベットを含む場合はそのまま。
export function toYahooSymbol(ticker: string): string {
  const t = ticker.trim().toUpperCase();
  if (/^\d{4}[A-Z]?$/.test(t)) return `${t}.T`;
  return t;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function mapQuote(ticker: string, q: any): QuoteData {
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

export function mapFundamentals(ticker: string, qs: any): Fundamentals {
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
