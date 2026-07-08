// 市場データのクライアント取得層（GitHub Pages 静的版）
// GitHub Actions が毎日生成する /market/market.json を読み込み、
// 見つからない銘柄・取得失敗時は決定論的なサンプルデータにフォールバックする。

import { BASE_PATH } from "./base-path";
import type { Fundamentals, MarketResult, QuoteData } from "./types";
import { generateMockMarket } from "@/data/mock-market";

export type MarketBundle = {
  generatedAt: string; // ISO日時
  mode?: "live" | "mock"; // mock = サンプル値で生成されたバンドル
  quotes: Record<string, QuoteData>;
  fundamentals: Record<string, Fundamentals>;
};

const CACHE_KEY = "market-bundle-v1";

let bundleCache: MarketBundle | null = null;
let bundlePromise: Promise<MarketBundle | null> | null = null;

async function fetchBundle(): Promise<MarketBundle | null> {
  try {
    const res = await fetch(`${BASE_PATH}/market/market.json`, { cache: "no-cache" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const bundle = (await res.json()) as MarketBundle;
    if (!bundle.quotes) throw new Error("invalid bundle");
    try {
      window.localStorage.setItem(CACHE_KEY, JSON.stringify(bundle));
    } catch {
      // 保存失敗は無視（メモリキャッシュで動作継続）
    }
    return bundle;
  } catch {
    // オフライン時は前回取得分を使う
    try {
      const raw = window.localStorage.getItem(CACHE_KEY);
      if (raw) return JSON.parse(raw) as MarketBundle;
    } catch {
      /* noop */
    }
    return null;
  }
}

export async function loadMarketBundle(): Promise<MarketBundle | null> {
  if (bundleCache) return bundleCache;
  if (!bundlePromise) {
    bundlePromise = fetchBundle().then((b) => {
      bundleCache = b;
      return b;
    });
  }
  return bundlePromise;
}

// バンドルから株価を引く（無ければサンプル生成）
export function quoteFromBundle(
  bundle: MarketBundle | null,
  ticker: string,
  name?: string,
): MarketResult<QuoteData> {
  const code = ticker.trim();
  const hit = bundle?.quotes?.[code];
  if (hit) {
    return {
      data: hit,
      source: bundle?.mode === "mock" ? "mock" : "live",
      fetchedAt: bundle ? Date.parse(bundle.generatedAt) : undefined,
    };
  }
  return { data: generateMockMarket(code, name).quote, source: "mock" };
}

export function fundamentalsFromBundle(
  bundle: MarketBundle | null,
  ticker: string,
  name?: string,
): MarketResult<Fundamentals> {
  const code = ticker.trim();
  const hit = bundle?.fundamentals?.[code];
  if (hit) {
    return {
      data: hit,
      source: bundle?.mode === "mock" ? "mock" : "live",
      fetchedAt: bundle ? Date.parse(bundle.generatedAt) : undefined,
    };
  }
  return { data: generateMockMarket(code, name).fundamentals, source: "mock" };
}

export function bundleDateLabel(bundle: MarketBundle | null): string | null {
  if (!bundle?.generatedAt) return null;
  const d = new Date(bundle.generatedAt);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
