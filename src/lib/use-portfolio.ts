"use client";

// データ層と市場データを束ねる React フック群

import { useEffect, useMemo, useState } from "react";
import { loadData, subscribe, emptyData, type PortfolioData } from "./store";
import {
  loadMarketBundle,
  quoteFromBundle,
  fundamentalsFromBundle,
  bundleDateLabel,
  type MarketBundle,
} from "./market-client";
import { computePortfolio, type Portfolio } from "./compute-portfolio";
import { deriveAssetSeries, type SeriesPoint } from "./derive-series";
import type { Fundamentals, MarketResult, QuoteData } from "./types";

const INITIAL: PortfolioData = emptyData();

// localStorage のデータ（変更を購読）。ready=false の間はローディング表示にする
// ことでサーバープリレンダーとのハイドレーション不一致を避ける。
export function usePortfolioData(): { data: PortfolioData; ready: boolean } {
  const [state, setState] = useState<{ data: PortfolioData; ready: boolean }>({
    data: INITIAL,
    ready: false,
  });
  useEffect(() => {
    const update = () => setState({ data: loadData(), ready: true });
    update();
    return subscribe(update);
  }, []);
  return state;
}

// 市場データ（undefined = 読み込み中, null = 静的JSONなし→サンプルにフォールバック）
export function useMarketBundle(): MarketBundle | null | undefined {
  const [bundle, setBundle] = useState<MarketBundle | null | undefined>(undefined);
  useEffect(() => {
    let active = true;
    void loadMarketBundle().then((b) => {
      if (active) setBundle(b);
    });
    return () => {
      active = false;
    };
  }, []);
  return bundle;
}

export type PortfolioState = {
  ready: boolean;
  data: PortfolioData;
  portfolio: Portfolio;
  // 資産推移: 実測スナップショット + 入出金明細からの推計（derived: true）
  series: SeriesPoint[];
  bundle: MarketBundle | null;
  marketDateLabel: string | null; // 市場データの取得日時（表示用）
  getQuote: (ticker: string, name?: string) => MarketResult<QuoteData>;
  getFundamentals: (ticker: string, name?: string) => MarketResult<Fundamentals>;
};

export function usePortfolio(): PortfolioState {
  const { data, ready } = usePortfolioData();
  const bundleState = useMarketBundle();
  const bundle = bundleState ?? null;

  const portfolio = useMemo(
    () => computePortfolio(data, (t, n) => quoteFromBundle(bundle, t, n)),
    [data, bundle],
  );
  const series = useMemo(() => deriveAssetSeries(data.snapshots, data.transactions), [data]);

  return {
    ready: ready && bundleState !== undefined,
    data,
    portfolio,
    series,
    bundle,
    // サンプル値バンドルの日時を「毎日更新」と誤解させないため live のみ表示
    marketDateLabel: bundle?.mode === "mock" ? null : bundleDateLabel(bundle),
    getQuote: (t, n) => quoteFromBundle(bundle, t, n),
    getFundamentals: (t, n) => fundamentalsFromBundle(bundle, t, n),
  };
}
