import { describe, expect, it } from "vitest";
import { fireTarget, projectAssets, simulate, yearsToTarget } from "@/lib/simulation";
import { computeRebalance } from "@/lib/rebalance";
import { paymentMonth, summarizeDividends } from "@/lib/dividends";
import { scoreDividend, scoreStock, scoreYutai } from "@/lib/scoring";
import { computeValuation } from "@/lib/valuation";
import type { Fundamentals, QuoteData } from "@/lib/types";
import type { UniverseStock } from "@/data/stock-universe";

describe("simulation", () => {
  it("利回り0%なら元本のみ積み上がる", () => {
    const series = projectAssets(1_000_000, 10_000, 0, 2);
    expect(series[1]).toBeCloseTo(1_120_000, 0);
    expect(series[2]).toBeCloseTo(1_240_000, 0);
  });

  it("複利で元本を上回る", () => {
    const series = projectAssets(1_000_000, 0, 5, 10);
    // 月次複利 (1+0.05/12)^120 ≈ 1.647
    expect(series[10]).toBeGreaterThan(1_600_000);
    expect(series[10]).toBeLessThan(1_700_000);
  });

  it("simulate は3シナリオ + 元本を返す", () => {
    const points = simulate({ initialAssets: 100, monthlyContribution: 0, annualReturnPct: 5, years: 3 });
    expect(points).toHaveLength(4);
    const last = points[3];
    expect(last.optimistic).toBeGreaterThan(last.standard);
    expect(last.standard).toBeGreaterThan(last.pessimistic);
    expect(last.principal).toBe(100);
  });

  it("FIRE目標は生活費の25倍", () => {
    expect(fireTarget(3_000_000)).toBe(75_000_000);
  });

  it("yearsToTarget: 達成済みなら0、届かなければnull", () => {
    expect(yearsToTarget(100, 0, 5, 50)).toBe(0);
    expect(yearsToTarget(0, 0, 0, 100)).toBeNull();
    const y = yearsToTarget(1_000_000, 100_000, 5, 10_000_000);
    expect(y).toBeGreaterThan(5);
    expect(y).toBeLessThan(10);
  });
});

describe("rebalance", () => {
  it("乖離と売買金額を計算する", () => {
    const r = computeRebalance({ stock: 600, cash: 400 }, { stock: 50, cash: 50 });
    expect(r.total).toBe(1000);
    const stock = r.rows.find((x) => x.assetClass === "stock")!;
    expect(stock.currentPct).toBe(60);
    expect(stock.diff).toBe(-100); // 100売却
    expect(r.maxDriftPct).toBe(10);
    expect(r.needsRebalance).toBe(true);
  });

  it("目標通りなら needsRebalance = false", () => {
    const r = computeRebalance({ stock: 500, cash: 500 }, { stock: 50, cash: 50 });
    expect(r.needsRebalance).toBe(false);
  });

  it("目標にあるが未保有のクラスも行に含まれる", () => {
    const r = computeRebalance({ stock: 1000 }, { stock: 70, fund: 30 });
    const fund = r.rows.find((x) => x.assetClass === "fund")!;
    expect(fund.diff).toBe(300);
  });
});

describe("dividends", () => {
  it("受取月 = 権利確定月 + 3ヶ月（12月をまたぐ）", () => {
    expect(paymentMonth(3)).toBe(6);
    expect(paymentMonth(9)).toBe(12);
    expect(paymentMonth(12)).toBe(3);
  });

  it("課税口座は20.315%課税、NISAは非課税", () => {
    const s = summarizeDividends([
      { ticker: "7203", name: "トヨタ", quantity: 100, dividendRate: 90, exMonths: [3, 9], taxable: true },
      { ticker: "9433", name: "KDDI", quantity: 100, dividendRate: 150, exMonths: [3, 9], taxable: false },
    ]);
    expect(s.annualGross).toBe(9000 + 15000);
    expect(s.annualNet).toBeCloseTo(9000 * (1 - 0.20315) + 15000, 2);
    // 6月と12月に半分ずつ
    expect(s.monthly[5].gross).toBeCloseTo((9000 + 15000) / 2, 2);
    expect(s.monthly[11].gross).toBeCloseTo((9000 + 15000) / 2, 2);
  });

  it("YOC は取得単価ベース", () => {
    const s = summarizeDividends([
      { ticker: "7203", name: "トヨタ", quantity: 100, dividendRate: 90, exMonths: [3], taxable: true, avgCost: 2000 },
    ]);
    expect(s.perStock[0].yieldOnCost).toBeCloseTo(4.5, 5);
  });
});

describe("scoring", () => {
  const quote: QuoteData = {
    ticker: "8058",
    name: "三菱商事",
    price: 3000,
    currency: "JPY",
    sharesOutstanding: 4e9,
    epsTrailing: 290,
    epsForward: 300,
    trailingPE: 10,
    forwardPE: 10,
    dividendRate: 110,
    dividendYieldPct: 3.67,
    fiftyTwoWeekLow: 2500,
    fiftyTwoWeekHigh: 3800,
  };
  const fund: Fundamentals = {
    ticker: "8058",
    payoutRatio: 0.35,
    earningsGrowth: 0.05,
    fcfHistory: [
      { year: 2023, fcf: 1.0e12 },
      { year: 2024, fcf: 1.1e12 },
    ],
    totalDebt: 5e12,
    totalCash: 2e12,
  };
  const stock: UniverseStock = { code: "8058", name: "三菱商事", sector: "商社", exMonths: [3, 9] };

  it("健全な配当性向 × 高利回りは高スコア", () => {
    const { score } = scoreDividend(quote, fund);
    expect(score).toBeGreaterThan(3.5);
  });

  it("無配は0点", () => {
    const { score, reasons } = scoreDividend({ ...quote, dividendRate: 0, dividendYieldPct: 0 }, fund);
    expect(score).toBe(0);
    expect(reasons[0]).toContain("無配");
  });

  it("配当性向が高すぎると減点", () => {
    const healthy = scoreDividend(quote, fund).score;
    const risky = scoreDividend(quote, { ...fund, payoutRatio: 0.95 }).score;
    expect(risky).toBeLessThan(healthy);
  });

  it("優待なしは0点、優待ありは魅力度ベース", () => {
    expect(scoreYutai(stock, quote).score).toBe(0);
    const withYutai: UniverseStock = {
      ...stock,
      yutai: { content: "優待券", minShares: 100, estAnnualValue: 5000, attractiveness: 4 },
    };
    expect(scoreYutai(withYutai, quote).score).toBeGreaterThanOrEqual(4);
  });

  it("総合スコアは0〜5に収まり理由がつく", () => {
    const valuation = computeValuation(quote, fund);
    const s = scoreStock(stock, quote, fund, valuation);
    expect(s.total).toBeGreaterThanOrEqual(0);
    expect(s.total).toBeLessThanOrEqual(5);
    expect(s.reasons.length).toBeGreaterThan(0);
    expect(s.stars % 0.5).toBe(0);
  });
});
