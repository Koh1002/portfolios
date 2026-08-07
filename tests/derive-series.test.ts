import { describe, expect, it } from "vitest";
import {
  deriveAssetSeries,
  isInvestmentTransfer,
  monthEnd,
  transactionCoverage,
} from "@/lib/derive-series";
import type { Snapshot, Transaction } from "@/lib/store";

function tx(date: string, amount: number, category = "食費"): Transaction {
  return { id: 0, date, amount, category, subCategory: "", description: "", institution: "" };
}

function snap(date: string, category: string, amount: number): Snapshot {
  return { date, category, amount, source: "manual" };
}

describe("monthEnd", () => {
  it("月末日を返す（うるう年含む）", () => {
    expect(monthEnd("2026-01")).toBe("2026-01-31");
    expect(monthEnd("2026-02")).toBe("2026-02-28");
    expect(monthEnd("2024-02")).toBe("2024-02-29");
    expect(monthEnd("2026-04")).toBe("2026-04-30");
  });
});

describe("isInvestmentTransfer", () => {
  it("貯金・投資系カテゴリを判定する", () => {
    expect(isInvestmentTransfer("貯金・投資")).toBe(true);
    expect(isInvestmentTransfer("積立")).toBe(true);
    expect(isInvestmentTransfer("食費")).toBe(false);
  });
});

describe("deriveAssetSeries", () => {
  const baseline: Snapshot[] = [
    snap("2026-03-31", "cash", 1_000_000),
    snap("2026-03-31", "stock", 500_000),
  ];

  it("実測点がなければ空", () => {
    expect(deriveAssetSeries([], [tx("2026-04-10", -1000)])).toEqual([]);
  });

  it("基準日以降は入出金を積み上げて前方推計する", () => {
    const txs = [
      tx("2026-04-25", 300_000, "収入"),
      tx("2026-04-10", -100_000),
      tx("2026-05-10", -50_000),
    ];
    const series = deriveAssetSeries(baseline, txs);
    // 3月末(実測) + 4月末(推計) + 5月末(推計)
    expect(series.map((p) => [p.date, p.derived])).toEqual([
      ["2026-03-31", false],
      ["2026-04-30", true],
      ["2026-05-31", true],
    ]);
    const apr = series[1];
    expect(apr.byClass.cash).toBe(1_000_000 + 300_000 - 100_000);
    expect(apr.byClass.stock).toBe(500_000); // 株式は基準のまま
    const may = series[2];
    expect(may.byClass.cash).toBe(1_200_000 - 50_000);
    expect(may.total).toBe(1_150_000 + 500_000);
  });

  it("基準日以前は入出金を巻き戻して後方推計する（過去CSVの遡り取込）", () => {
    const txs = [
      tx("2026-02-25", 300_000, "収入"),
      tx("2026-02-10", -100_000),
    ];
    const series = deriveAssetSeries(baseline, txs);
    // 2月末(推計) + 3月末(実測)
    expect(series.map((p) => p.date)).toEqual(["2026-02-28", "2026-03-31"]);
    const feb = series[0];
    expect(feb.derived).toBe(true);
    // 2月末時点 = 3月末 −（2月末より後〜3月末までの入出金: なし）だが、
    // 2月の取引は2月末以前なので巻き戻し対象外 → 2月末 = 3月末の現金
    // ※2月中の取引は「2月末残高にはすでに反映済み」の扱い
    expect(feb.byClass.cash).toBe(1_000_000);
  });

  it("後方推計は基準より前の月の取引を正しく巻き戻す", () => {
    const txs = [
      tx("2026-03-05", 300_000, "収入"), // 3月分（基準3/31より前）
      tx("2026-03-20", -100_000), // 3月分
    ];
    const series = deriveAssetSeries(baseline, txs);
    // 3月の取引しかないので点は 3月末(実測) のみ…ではなく months={2026-03} → 3/31 は実測なので推計点なし
    expect(series).toHaveLength(1);
    expect(series[0].derived).toBe(false);

    // 2月の月末を推計させるため2月の取引も追加
    const series2 = deriveAssetSeries(baseline, [...txs, tx("2026-02-15", -10_000)]);
    const feb = series2.find((p) => p.date === "2026-02-28")!;
    // 2月末 = 3月末実測 − (2/28, 3/31] の純入出金 (+300,000 −100,000 = +200,000)
    expect(feb.byClass.cash).toBe(1_000_000 - 200_000);
  });

  it("貯金・投資カテゴリは現金→投信の振替として総資産を減らさない", () => {
    const txs = [tx("2026-04-27", -50_000, "貯金・投資")];
    const series = deriveAssetSeries(baseline, txs);
    const apr = series.find((p) => p.date === "2026-04-30")!;
    expect(apr.byClass.cash).toBe(950_000);
    expect(apr.byClass.fund).toBe(50_000);
    expect(apr.total).toBe(1_500_000); // 総資産は不変
  });

  it("複数の実測点がある場合は最寄りの実測点を基準にする", () => {
    const snaps = [
      ...baseline,
      snap("2026-06-30", "cash", 2_000_000),
      snap("2026-06-30", "stock", 600_000),
    ];
    const txs = [
      tx("2026-04-10", -100_000), // 3月末基準の前方推計に使われる
      tx("2026-07-10", 300_000, "収入"), // 6月末基準の前方推計
    ];
    const series = deriveAssetSeries(snaps, txs);
    const apr = series.find((p) => p.date === "2026-04-30")!;
    expect(apr.byClass.cash).toBe(900_000); // 3月末基準
    const jul = series.find((p) => p.date === "2026-07-31")!;
    expect(jul.byClass.cash).toBe(2_300_000); // 6月末基準
    expect(jul.byClass.stock).toBe(600_000);
    // 実測点は上書きされない
    const jun = series.find((p) => p.date === "2026-06-30")!;
    expect(jun.derived).toBe(false);
    expect(jun.byClass.cash).toBe(2_000_000);
  });
});

describe("transactionCoverage", () => {
  it("取込済み月と歯抜け月を返す", () => {
    const txs = [tx("2026-01-10", -1), tx("2026-02-10", -1), tx("2026-04-10", -1)];
    const c = transactionCoverage(txs);
    expect(c.months).toEqual(["2026-01", "2026-02", "2026-04"]);
    expect(c.missing).toEqual(["2026-03"]);
  });

  it("年またぎの歯抜けも検出する", () => {
    const txs = [tx("2025-11-10", -1), tx("2026-02-10", -1)];
    expect(transactionCoverage(txs).missing).toEqual(["2025-12", "2026-01"]);
  });

  it("空なら空", () => {
    expect(transactionCoverage([])).toEqual({ months: [], missing: [] });
  });
});
