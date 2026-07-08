// 銘柄提案のスコアリング（純粋関数）
// 株価分析・配当・株主優待の3観点を各0〜5点で評価し、総合おすすめ度（★1〜5）を算出する。

import type { QuoteData, Fundamentals } from "./types";
import type { UniverseStock } from "@/data/stock-universe";
import type { ValuationResult } from "./valuation";

export type StockScore = {
  code: string;
  valuationScore: number; // 株価分析 0-5
  dividendScore: number; // 配当 0-5
  yutaiScore: number; // 株主優待 0-5
  total: number; // 総合 0-5
  stars: number; // ★数（0.5刻み）
  reasons: string[];
};

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

// 株価分析: 理論株価との乖離（70%）+ 52週レンジ内の位置（30%）
export function scoreValuation(valuation: ValuationResult, quote: QuoteData): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let fairScore = 2.5;
  if (valuation.ratio != null) {
    // ratio 0.7（30%割安）→ 5点、1.0 → 2.5点、1.3（30%割高）→ 0点
    fairScore = clamp(2.5 + ((1 - valuation.ratio) / 0.3) * 2.5, 0, 5);
    if (valuation.verdict === "割安" || valuation.verdict === "やや割安") {
      reasons.push(`理論株価より${Math.abs(Math.round(valuation.upsidePct ?? 0))}%割安（${valuation.verdict}）`);
    } else if (valuation.verdict === "割高" || valuation.verdict === "やや割高") {
      reasons.push(`理論株価より割高（${valuation.verdict}）`);
    } else {
      reasons.push("株価は理論株価とほぼ同水準（適正圏）");
    }
  } else {
    reasons.push("理論株価を計算できるデータが不足");
  }

  let rangeScore = 2.5;
  const { fiftyTwoWeekLow: lo, fiftyTwoWeekHigh: hi, price } = quote;
  if (lo != null && hi != null && hi > lo && price > 0) {
    const pos = clamp((price - lo) / (hi - lo), 0, 1); // 0=安値圏, 1=高値圏
    rangeScore = (1 - pos) * 5;
    if (pos < 0.35) reasons.push("52週レンジの安値圏で仕込みやすい水準");
    else if (pos > 0.8) reasons.push("52週高値圏のため高値掴みに注意");
  }

  return { score: fairScore * 0.7 + rangeScore * 0.3, reasons };
}

// 配当: 利回り（スケール）× 配当性向の健全性（30〜60%が最良）
export function scoreDividend(quote: QuoteData, fund: Fundamentals): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  const yieldPct = quote.dividendYieldPct ?? (quote.dividendRate && quote.price > 0 ? (quote.dividendRate / quote.price) * 100 : 0);

  if (!yieldPct || yieldPct <= 0) {
    return { score: 0, reasons: ["無配（配当なし）"] };
  }
  // 利回り 4%以上 → 5点、2% → 2.5点
  let score = clamp((yieldPct / 4) * 5, 0, 5);

  const payout = fund.payoutRatio;
  if (payout != null) {
    const payoutPct = Math.round(payout * 100);
    if (payout >= 0.3 && payout <= 0.6) {
      reasons.push(`配当利回り${yieldPct.toFixed(1)}%・配当性向${payoutPct}%と健全`);
    } else if (payout > 0.8 || payout < 0) {
      score *= 0.5;
      reasons.push(`配当性向${payoutPct}%と高く減配リスクに注意`);
    } else if (payout > 0.6) {
      score *= 0.8;
      reasons.push(`配当利回り${yieldPct.toFixed(1)}%・配当性向${payoutPct}%はやや高め`);
    } else {
      reasons.push(`配当利回り${yieldPct.toFixed(1)}%・配当性向${payoutPct}%（増配余地あり）`);
    }
  } else {
    reasons.push(`配当利回り${yieldPct.toFixed(1)}%`);
  }
  return { score: clamp(score, 0, 5), reasons };
}

// 株主優待: ユニバースの静的データから評価（魅力度 + 優待利回り）
export function scoreYutai(stock: UniverseStock, quote: QuoteData): { score: number; reasons: string[] } {
  const y = stock.yutai;
  if (!y) return { score: 0, reasons: ["株主優待なし"] };
  let score: number = y.attractiveness;
  const cost = quote.price * y.minShares;
  if (y.estAnnualValue != null && cost > 0) {
    const yutaiYield = (y.estAnnualValue / cost) * 100;
    if (yutaiYield >= 1) score = clamp(score + 1, 0, 5);
    return {
      score,
      reasons: [`優待: ${y.content}（優待利回り目安${yutaiYield.toFixed(1)}%・${y.minShares}株〜）`],
    };
  }
  return { score, reasons: [`優待: ${y.content}（${y.minShares}株〜）`] };
}

export function scoreStock(
  stock: UniverseStock,
  quote: QuoteData,
  fund: Fundamentals,
  valuation: ValuationResult,
): StockScore {
  const v = scoreValuation(valuation, quote);
  const d = scoreDividend(quote, fund);
  const y = scoreYutai(stock, quote);
  // 総合: 株価分析45% + 配当35% + 優待20%
  const total = v.score * 0.45 + d.score * 0.35 + y.score * 0.2;
  return {
    code: stock.code,
    valuationScore: v.score,
    dividendScore: d.score,
    yutaiScore: y.score,
    total,
    stars: Math.round(total * 2) / 2,
    reasons: [...v.reasons, ...d.reasons, ...y.reasons],
  };
}
