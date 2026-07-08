// オフライン/デモ用のサンプル市場データ生成器
// Yahoo Finance に接続できない環境でも全機能を確認できるように、
// ティッカーから決定論的に「それらしい」株価・財務データを生成する。
// 値はあくまでサンプルであり、UI 上では「サンプルデータ」と明示される。

import type { Fundamentals, QuoteData } from "@/lib/types";
import { findUniverseStock, type Sector } from "./stock-universe";

// ── 決定論的な擬似乱数 ──
function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type SectorPreset = {
  price: [number, number];
  per: [number, number];
  yieldPct: [number, number];
  growth: [number, number];
  margin: [number, number]; // 純利益率
};

const SECTOR_PRESETS: Record<Sector | "default", SectorPreset> = {
  半導体: { price: [8000, 40000], per: [20, 35], yieldPct: [0.8, 2.0], growth: [0.08, 0.18], margin: [0.12, 0.25] },
  AI: { price: [2000, 15000], per: [18, 40], yieldPct: [0.5, 2.5], growth: [0.05, 0.15], margin: [0.06, 0.15] },
  小売: { price: [1500, 9000], per: [15, 30], yieldPct: [1.0, 2.5], growth: [0.03, 0.08], margin: [0.02, 0.06] },
  製造メーカー: { price: [2000, 30000], per: [10, 25], yieldPct: [1.5, 3.5], growth: [0.03, 0.08], margin: [0.06, 0.15] },
  商社: { price: [2500, 8000], per: [8, 12], yieldPct: [3.0, 4.5], growth: [0.02, 0.06], margin: [0.03, 0.06] },
  サービス業: { price: [2000, 6000], per: [15, 35], yieldPct: [0.5, 2.0], growth: [0.04, 0.1], margin: [0.05, 0.12] },
  default: { price: [1000, 8000], per: [10, 25], yieldPct: [1.0, 3.0], growth: [0.02, 0.08], margin: [0.05, 0.1] },
};

// 主要銘柄はサンプルでも実勢に近い桁感になるよう手動設定（あくまで目安）
type Override = { price: number; eps: number; div: number; sharesB: number };
const OVERRIDES: Record<string, Override> = {
  "7203": { price: 3100, eps: 385, div: 95, sharesB: 13.1 }, // トヨタ
  "6758": { price: 3600, eps: 190, div: 25, sharesB: 6.0 }, // ソニーG
  "6861": { price: 68000, eps: 1650, div: 350, sharesB: 0.24 }, // キーエンス
  "8035": { price: 27000, eps: 1150, div: 570, sharesB: 0.47 }, // 東エレク
  "6857": { price: 11000, eps: 290, div: 45, sharesB: 0.75 }, // アドバンテスト
  "9984": { price: 13500, eps: 800, div: 44, sharesB: 1.4 }, // ソフトバンクG
  "8058": { price: 3100, eps: 290, div: 110, sharesB: 4.0 }, // 三菱商事
  "8001": { price: 7800, eps: 620, div: 210, sharesB: 1.45 }, // 伊藤忠
  "8031": { price: 3500, eps: 340, div: 105, sharesB: 2.9 }, // 三井物産
  "9983": { price: 52000, eps: 1450, div: 420, sharesB: 0.3 }, // ファストリ
  "8267": { price: 3900, eps: 55, div: 40, sharesB: 0.87 }, // イオン
  "4661": { price: 3400, eps: 68, div: 14, sharesB: 1.8 }, // OLC
  "9433": { price: 4900, eps: 330, div: 150, sharesB: 2.1 }, // KDDI
  "6501": { price: 4200, eps: 190, div: 60, sharesB: 4.6 }, // 日立
  "7267": { price: 1600, eps: 210, div: 68, sharesB: 4.9 }, // ホンダ
  "6146": { price: 45000, eps: 950, div: 380, sharesB: 0.11 }, // ディスコ
};

function pick(rand: () => number, [lo, hi]: [number, number]): number {
  return lo + (hi - lo) * rand();
}

function roundPrice(p: number): number {
  if (p >= 10000) return Math.round(p / 100) * 100;
  if (p >= 1000) return Math.round(p / 10) * 10;
  return Math.round(p);
}

export type MockMarket = { quote: QuoteData; fundamentals: Fundamentals };

export function generateMockMarket(ticker: string, name?: string): MockMarket {
  const code = ticker.replace(/\.T$/i, "");
  const uni = findUniverseStock(code);
  const preset = SECTOR_PRESETS[uni?.sector ?? "default"];
  const rand = mulberry32(hashCode(code));
  const ov = OVERRIDES[code];

  const growth = pick(rand, preset.growth);
  const per = pick(rand, preset.per);
  const price = ov ? ov.price : roundPrice(pick(rand, preset.price));
  const eps = ov ? ov.eps : price / per;
  const dividendRate = ov ? ov.div : Math.round((price * pick(rand, preset.yieldPct)) / 100);
  const shares = ov ? ov.sharesB * 1e9 : Math.round(pick(rand, [0.1, 3]) * 1e9);

  const margin = pick(rand, preset.margin);
  const netIncome = eps * shares;
  const revenue = netIncome / margin;
  const ocf = netIncome * pick(rand, [1.1, 1.5]);
  const capex = ocf * pick(rand, [0.25, 0.5]);
  const fcf = ocf - capex;

  const baseYear = 2025; // サンプルデータの基準年
  const fcfHistory = [3, 2, 1, 0].map((back) => {
    const factor = Math.pow(1 + growth * pick(rand, [0.6, 1.2]), -back);
    const o = ocf * factor;
    const c = capex * factor * pick(rand, [0.9, 1.1]);
    return { year: baseYear - back, ocf: Math.round(o), capex: Math.round(c), fcf: Math.round(o - c) };
  });
  const annualResults = [3, 2, 1, 0].map((back) => {
    const factor = Math.pow(1 + growth, -back);
    return {
      year: baseYear - back,
      revenue: Math.round(revenue * factor),
      netIncome: Math.round(netIncome * factor * pick(rand, [0.85, 1.1])),
    };
  });
  const quarterlyResults = [7, 6, 5, 4, 3, 2, 1, 0].map((back) => {
    const q = ((11 - back) % 4) + 1;
    const year = baseYear - Math.floor((back + 1) / 4);
    const seasonal = 1 + (q === 4 ? 0.1 : q === 1 ? -0.05 : 0) + (rand() - 0.5) * 0.1;
    const g = Math.pow(1 + growth, -back / 4);
    return {
      label: `${year}Q${q}`,
      revenue: Math.round((revenue / 4) * seasonal * g),
      earnings: Math.round((netIncome / 4) * seasonal * g * pick(rand, [0.8, 1.2])),
    };
  });

  const quote: QuoteData = {
    ticker: code,
    name: name ?? uni?.name ?? `銘柄${code}`,
    price,
    currency: "JPY",
    previousClose: roundPrice(price * (1 + (rand() - 0.5) * 0.02)),
    changePercent: (rand() - 0.5) * 3,
    fiftyTwoWeekLow: roundPrice(price * pick(rand, [0.65, 0.85])),
    fiftyTwoWeekHigh: roundPrice(price * pick(rand, [1.05, 1.35])),
    marketCap: Math.round(price * shares),
    trailingPE: price / eps,
    forwardPE: price / (eps * (1 + growth / 2)),
    epsTrailing: Math.round(eps * 10) / 10,
    epsForward: Math.round(eps * (1 + growth / 2) * 10) / 10,
    priceToBook: price / (eps * 8),
    bookValue: Math.round(eps * 8),
    dividendRate,
    dividendYieldPct: (dividendRate / price) * 100,
    sharesOutstanding: shares,
  };

  const fundamentals: Fundamentals = {
    ticker: code,
    payoutRatio: netIncome > 0 ? (dividendRate * shares) / netIncome : undefined,
    operatingCashflow: Math.round(ocf),
    freeCashflow: Math.round(fcf),
    totalDebt: Math.round(ocf * pick(rand, [0.5, 2.5])),
    totalCash: Math.round(ocf * pick(rand, [0.8, 2.0])),
    earningsGrowth: growth,
    revenueGrowth: growth * pick(rand, [0.6, 1.0]),
    fcfHistory,
    annualResults,
    quarterlyResults,
  };

  return { quote, fundamentals };
}
