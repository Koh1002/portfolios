// 配当カレンダー・配当集計（純粋関数）
// 日本株は通常、権利確定月の約2〜3ヶ月後に支払われるため、
// 受取月 = 権利確定月 + 3ヶ月 として月別に按分する。

import { DIVIDEND_TAX_RATE } from "./types";

export type DividendHolding = {
  ticker: string;
  name: string;
  quantity: number;
  dividendRate?: number; // 年間1株配当（円）
  exMonths: number[]; // 権利確定月
  taxable: boolean; // 課税口座か（NISAなら false）
  avgCost?: number; // YOC計算用
};

export type MonthlyDividend = {
  month: number; // 1-12
  gross: number;
  net: number;
  items: { ticker: string; name: string; amount: number }[];
};

export type DividendSummary = {
  annualGross: number;
  annualNet: number;
  monthly: MonthlyDividend[];
  perStock: {
    ticker: string;
    name: string;
    annualGross: number;
    annualNet: number;
    yieldOnCost?: number; // 取得単価ベースの利回り（%）
    payMonths: number[];
  }[];
};

export function paymentMonth(exMonth: number): number {
  return ((exMonth - 1 + 3) % 12) + 1;
}

export function summarizeDividends(holdings: DividendHolding[]): DividendSummary {
  const monthly: MonthlyDividend[] = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    gross: 0,
    net: 0,
    items: [],
  }));
  const perStock: DividendSummary["perStock"] = [];
  let annualGross = 0;
  let annualNet = 0;

  for (const h of holdings) {
    if (!h.dividendRate || h.dividendRate <= 0 || h.quantity <= 0) continue;
    const gross = h.dividendRate * h.quantity;
    const net = h.taxable ? gross * (1 - DIVIDEND_TAX_RATE) : gross;
    annualGross += gross;
    annualNet += net;

    const exMonths = h.exMonths.length > 0 ? h.exMonths : [3, 9];
    const payMonths = exMonths.map(paymentMonth);
    const perPayment = gross / exMonths.length;
    const perPaymentNet = net / exMonths.length;
    for (const m of payMonths) {
      const bucket = monthly[m - 1];
      bucket.gross += perPayment;
      bucket.net += perPaymentNet;
      bucket.items.push({ ticker: h.ticker, name: h.name, amount: perPayment });
    }
    perStock.push({
      ticker: h.ticker,
      name: h.name,
      annualGross: gross,
      annualNet: net,
      yieldOnCost:
        h.avgCost && h.avgCost > 0 ? (h.dividendRate / h.avgCost) * 100 : undefined,
      payMonths,
    });
  }
  perStock.sort((a, b) => b.annualGross - a.annualGross);
  return { annualGross, annualNet, monthly, perStock };
}
