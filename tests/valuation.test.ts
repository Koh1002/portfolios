import { describe, expect, it } from "vitest";
import {
  computeDcf,
  computeDdm,
  computePer,
  computeValuation,
  fcfCagr,
  verdictFromRatio,
} from "@/lib/valuation";
import { DEFAULT_DCF_PARAMS, type Fundamentals, type QuoteData } from "@/lib/types";

const baseQuote: QuoteData = {
  ticker: "9999",
  name: "テスト株式会社",
  price: 1000,
  currency: "JPY",
  sharesOutstanding: 1_000_000,
  epsTrailing: 100,
  epsForward: 110,
  trailingPE: 10,
  forwardPE: 9,
  dividendRate: 40,
  dividendYieldPct: 4,
};

const baseFund: Fundamentals = {
  ticker: "9999",
  payoutRatio: 0.4,
  earningsGrowth: 0.05,
  totalDebt: 50_000_000,
  totalCash: 30_000_000,
  fcfHistory: [
    { year: 2022, fcf: 90_000_000 },
    { year: 2023, fcf: 95_000_000 },
    { year: 2024, fcf: 100_000_000 },
  ],
};

describe("computeDcf", () => {
  it("FCF・成長率・割引率から1株価値を計算する", () => {
    const r = computeDcf(baseQuote, baseFund, DEFAULT_DCF_PARAMS);
    expect(r).not.toBeNull();
    // ベースFCFは直近(100M)と平均(95M)の保守的な方 = 95M
    expect(r!.baseFcf).toBe(95_000_000);
    // 成長率はアナリスト予想5%とFCF CAGR(≈5.4%)の低い方 = 5%
    expect(r!.usedGrowth).toBeCloseTo(0.05, 5);
    expect(r!.projection).toHaveLength(5);
    // 1年目FCF = 95M × 1.05
    expect(r!.projection[0].fcf).toBeCloseTo(99_750_000, 0);
    // 純有利子負債 = 50M - 30M = 20M
    expect(r!.netDebt).toBe(20_000_000);
    expect(r!.fairValue).toBeGreaterThan(0);
    // 手計算による検証: PV合計 + 残存価値PV - netDebt を株数で割った値
    const expectedEquity = r!.enterpriseValue - 20_000_000;
    expect(r!.fairValue).toBeCloseTo(expectedEquity / 1_000_000, 6);
  });

  it("FCFが赤字なら null", () => {
    const r = computeDcf(
      baseQuote,
      { ...baseFund, fcfHistory: [{ year: 2024, fcf: -10_000_000 }] },
      DEFAULT_DCF_PARAMS,
    );
    expect(r).toBeNull();
  });

  it("成長率は上限でキャップされる", () => {
    const r = computeDcf(baseQuote, { ...baseFund, earningsGrowth: 0.5 }, DEFAULT_DCF_PARAMS);
    expect(r!.usedGrowth).toBeLessThanOrEqual(DEFAULT_DCF_PARAMS.growthCap);
  });

  it("発行株式数がなければ null", () => {
    const r = computeDcf({ ...baseQuote, sharesOutstanding: undefined }, baseFund);
    expect(r).toBeNull();
  });
});

describe("computePer", () => {
  it("予想EPS × 妥当PER（実績と予想の平均）", () => {
    const r = computePer(baseQuote);
    expect(r).not.toBeNull();
    expect(r!.usedEps).toBe(110);
    expect(r!.usedPer).toBeCloseTo(9.5, 5);
    expect(r!.fairValue).toBeCloseTo(110 * 9.5, 5);
  });

  it("PERは8〜25倍でキャップされる", () => {
    const high = computePer({ ...baseQuote, trailingPE: 80, forwardPE: 90 });
    expect(high!.usedPer).toBe(25);
    const low = computePer({ ...baseQuote, trailingPE: 3, forwardPE: 4 });
    expect(low!.usedPer).toBe(8);
  });

  it("EPSが赤字なら null", () => {
    expect(computePer({ ...baseQuote, epsForward: -10, epsTrailing: -5 })).toBeNull();
  });
});

describe("computeDdm", () => {
  it("ゴードンモデルで計算する", () => {
    const r = computeDdm(baseQuote, baseFund, DEFAULT_DCF_PARAMS);
    expect(r).not.toBeNull();
    // g = min(5%, 3%) = 3%, fair = 40×1.03 / (0.08-0.03) = 824
    expect(r!.usedGrowth).toBeCloseTo(0.03, 5);
    expect(r!.fairValue).toBeCloseTo((40 * 1.03) / 0.05, 4);
  });

  it("無配なら null", () => {
    expect(computeDdm({ ...baseQuote, dividendRate: 0 }, baseFund)).toBeNull();
  });

  it("配当性向90%超なら null（タコ配は対象外）", () => {
    expect(computeDdm(baseQuote, { ...baseFund, payoutRatio: 0.95 })).toBeNull();
  });
});

describe("verdictFromRatio", () => {
  it("5段階判定の境界", () => {
    expect(verdictFromRatio(0.7)).toBe("割安");
    expect(verdictFromRatio(0.8)).toBe("やや割安");
    expect(verdictFromRatio(1.0)).toBe("適正");
    expect(verdictFromRatio(1.2)).toBe("やや割高");
    expect(verdictFromRatio(1.5)).toBe("割高");
  });
});

describe("computeValuation", () => {
  it("3手法の加重平均で理論株価と判定を返す", () => {
    const r = computeValuation(baseQuote, baseFund, DEFAULT_DCF_PARAMS);
    expect(r.fairValue).not.toBeNull();
    expect(r.verdict).not.toBeNull();
    // 重みの合計は1
    expect(r.weights.dcf + r.weights.per + r.weights.ddm).toBeCloseTo(1, 5);
  });

  it("使えない手法の重みは再配分される", () => {
    const r = computeValuation(
      { ...baseQuote, dividendRate: 0 }, // DDM不可
      baseFund,
      DEFAULT_DCF_PARAMS,
    );
    expect(r.ddm).toBeNull();
    expect(r.weights.ddm).toBe(0);
    expect(r.weights.dcf + r.weights.per).toBeCloseTo(1, 5);
    // DCF:PER = 0.5:0.3 → 0.625:0.375
    expect(r.weights.dcf).toBeCloseTo(0.625, 5);
  });
});

describe("fcfCagr", () => {
  it("正のFCF系列からCAGRを計算", () => {
    const g = fcfCagr([{ fcf: 100 }, { fcf: 121 }]);
    expect(g).toBeCloseTo(0.21, 5);
  });
  it("データ不足なら undefined", () => {
    expect(fcfCagr([{ fcf: 100 }])).toBeUndefined();
    expect(fcfCagr(undefined)).toBeUndefined();
  });
});
