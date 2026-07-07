import { describe, expect, it } from "vitest";
import iconv from "iconv-lite";
import {
  decodeCsvBuffer,
  detectFormat,
  parseCsv,
  parseHoldingsCsv,
  parseMfBudgetCsv,
  parseMfTrendCsv,
  parseNumber,
  normalizeDate,
} from "@/lib/csv/parse";

const MF_TREND = `日付,合計（円）,預金・現金・暗号資産（円）,株式(現物)（円）,投資信託（円）,年金（円）,ポイント（円）
2025/05/01,"5,000,000","2,000,000","1,800,000","1,100,000","80,000","20,000"
2025/06/01,"5,200,000","2,050,000","1,900,000","1,150,000","80,000","20,000"
`;

const MF_BUDGET = `計算対象,日付,内容,金額（円）,保有金融機関,大項目,中項目,メモ,振替,ID
1,2025/06/25,給与,300000,三菱UFJ銀行,収入,給与,,0,aaa
1,2025/06/20,スーパー,-8500,楽天カード,食費,食料品,,0,bbb
0,2025/06/19,対象外,-999,楽天カード,食費,食料品,,0,ccc
1,2025/06/18,口座振替,-50000,三菱UFJ銀行,その他,振替,,1,ddd
`;

const SBI_HOLDINGS = `保有証券一覧
株式（現物/特定預り）
銘柄コード,銘柄名称,保有株数,取得単価,現在値,評価額
7203,トヨタ自動車,100,2600,3100,310000
8058,三菱商事,200,2800,3100,620000
株式（現物/NISA預り（成長投資枠））
銘柄コード,銘柄名称,保有株数,取得単価,現在値,評価額
9433,ＫＤＤＩ,100,4200,4900,490000
投資信託（金額/特定預り）
ファンド名,保有口数,取得単価,基準価額,評価額
ｅＭＡＸＩＳ Ｓｌｉｍ 米国株式(S&P500),500000,18000,25000,1250000
`;

const RAKUTEN_HOLDINGS = `種別,銘柄コード・ティッカー,銘柄名,口座,保有数量,平均取得価額,評価額
国内株式,6758,ソニーグループ,特定,100,"2,900","360,000"
投資信託,,eMAXIS Slim 全世界株式（オール・カントリー）,つみたてNISA,300000,15000,"550,000"
`;

describe("decodeCsvBuffer", () => {
  it("Shift_JIS を自動判定してデコードする", () => {
    const sjis = iconv.encode(MF_BUDGET, "shift_jis");
    const text = decodeCsvBuffer(sjis);
    expect(text).toContain("計算対象");
    expect(text).toContain("給与");
  });
  it("UTF-8 はそのまま読める", () => {
    const text = decodeCsvBuffer(Buffer.from(MF_TREND, "utf8"));
    expect(text).toContain("日付");
  });
});

describe("parseNumber / normalizeDate", () => {
  it("カンマ・引用符・単位を除去して数値化", () => {
    expect(parseNumber('"1,234,567"')).toBe(1234567);
    expect(parseNumber("2,500円")).toBe(2500);
    expect(parseNumber("-8500")).toBe(-8500);
    expect(parseNumber("")).toBeNull();
    expect(parseNumber("−")).toBeNull();
  });
  it("日付の正規化", () => {
    expect(normalizeDate("2025/06/01")).toBe("2025-06-01");
    expect(normalizeDate("2025-6-1")).toBe("2025-06-01");
    expect(normalizeDate("2025年6月1日")).toBe("2025-06-01");
    expect(normalizeDate("合計")).toBeNull();
  });
});

describe("detectFormat", () => {
  it("3種類のフォーマットを判定する", () => {
    expect(detectFormat(MF_TREND)).toBe("snapshots");
    expect(detectFormat(MF_BUDGET)).toBe("transactions");
    expect(detectFormat(SBI_HOLDINGS)).toBe("holdings");
    expect(detectFormat(RAKUTEN_HOLDINGS)).toBe("holdings");
    expect(detectFormat("foo,bar\n1,2")).toBe("unknown");
  });
});

describe("parseMfTrendCsv", () => {
  it("日付×カテゴリ別のスナップショットに変換する", () => {
    const rows = parseMfTrendCsv(MF_TREND);
    // 2日 × 5カテゴリ（合計列は除外）
    expect(rows).toHaveLength(10);
    const cash = rows.find((r) => r.date === "2025-05-01" && r.category === "cash");
    expect(cash?.amount).toBe(2_000_000);
    const stock = rows.find((r) => r.date === "2025-06-01" && r.category === "stock");
    expect(stock?.amount).toBe(1_900_000);
    expect(rows.some((r) => r.category === "point")).toBe(true);
  });
});

describe("parseMfBudgetCsv", () => {
  it("計算対象外と振替を除いて取り込む", () => {
    const rows = parseMfBudgetCsv(MF_BUDGET);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ date: "2025-06-25", amount: 300000, category: "収入" });
    expect(rows[1]).toMatchObject({ date: "2025-06-20", amount: -8500, category: "食費", subCategory: "食料品" });
  });
});

describe("parseHoldingsCsv (SBI証券)", () => {
  it("セクション見出しからNISA区分と資産種別を判別する", () => {
    const rows = parseHoldingsCsv(SBI_HOLDINGS);
    expect(rows).toHaveLength(4);

    const toyota = rows.find((r) => r.ticker === "7203")!;
    expect(toyota).toMatchObject({ assetType: "stock", quantity: 100, avgCost: 2600, nisa: "none" });

    const kddi = rows.find((r) => r.ticker === "9433")!;
    expect(kddi.nisa).toBe("growth");

    const fund = rows.find((r) => r.assetType === "fund")!;
    expect(fund.name).toContain("ｅＭＡＸＩＳ");
    expect(fund.currentValue).toBe(1_250_000);
  });
});

describe("parseHoldingsCsv (楽天証券)", () => {
  it("種別・口座列から株式/投信とNISA区分を判別する", () => {
    const rows = parseHoldingsCsv(RAKUTEN_HOLDINGS);
    expect(rows).toHaveLength(2);

    const sony = rows.find((r) => r.ticker === "6758")!;
    expect(sony).toMatchObject({ assetType: "stock", quantity: 100, avgCost: 2900 });

    const fund = rows.find((r) => r.assetType === "fund")!;
    expect(fund.nisa).toBe("tsumitate");
    expect(fund.currentValue).toBe(550_000);
  });
});

describe("parseCsv (エントリポイント)", () => {
  it("Shift_JISのSBI CSVをバッファから直接処理できる", () => {
    const buf = iconv.encode(SBI_HOLDINGS, "shift_jis");
    const result = parseCsv(buf);
    expect(result.kind).toBe("holdings");
    if (result.kind === "holdings") {
      expect(result.rows).toHaveLength(4);
    }
  });
});
