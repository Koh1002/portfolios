// 資産クラス
export const ASSET_CLASSES = [
  "stock",
  "fund",
  "bond",
  "cash",
  "crypto",
  "pension",
  "point",
  "other",
] as const;
export type AssetClass = (typeof ASSET_CLASSES)[number];

export const ASSET_CLASS_LABEL: Record<AssetClass, string> = {
  stock: "株式",
  fund: "投資信託",
  bond: "債券",
  cash: "現金・預金",
  crypto: "暗号資産",
  pension: "年金",
  point: "ポイント",
  other: "その他",
};

export const ACCOUNT_TYPES = ["bank", "securities", "cash", "pension", "point", "other"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  bank: "銀行",
  securities: "証券",
  cash: "現金・財布",
  pension: "年金",
  point: "ポイント",
  other: "その他",
};

export const NISA_TYPES = ["none", "tsumitate", "growth", "general"] as const;
export type NisaType = (typeof NISA_TYPES)[number];

export const NISA_LABEL: Record<NisaType, string> = {
  none: "課税口座",
  tsumitate: "つみたてNISA",
  growth: "NISA成長投資枠",
  general: "一般NISA",
};

// 割安・割高の5段階判定
export type Verdict = "割安" | "やや割安" | "適正" | "やや割高" | "割高";

// 株価データ（Yahoo Finance quote 由来）
export type QuoteData = {
  ticker: string;
  name: string;
  price: number;
  currency: string;
  previousClose?: number;
  changePercent?: number;
  fiftyTwoWeekLow?: number;
  fiftyTwoWeekHigh?: number;
  marketCap?: number;
  trailingPE?: number;
  forwardPE?: number;
  epsTrailing?: number;
  epsForward?: number;
  priceToBook?: number;
  bookValue?: number;
  dividendRate?: number; // 年間1株配当（円）
  dividendYieldPct?: number; // 配当利回り（%）
  sharesOutstanding?: number;
};

// 財務データ（Yahoo Finance quoteSummary 由来）
export type Fundamentals = {
  ticker: string;
  payoutRatio?: number; // 配当性向 0-1
  operatingCashflow?: number;
  freeCashflow?: number;
  totalDebt?: number;
  totalCash?: number;
  earningsGrowth?: number; // 利益成長率（アナリスト/実績）
  revenueGrowth?: number;
  // 年次: 営業CF・設備投資・FCF（円）
  fcfHistory?: { year: number; ocf?: number; capex?: number; fcf?: number }[];
  // 年次: 売上・純利益（円）
  annualResults?: { year: number; revenue?: number; netIncome?: number }[];
  // 四半期: 売上・純利益（円）
  quarterlyResults?: { label: string; revenue?: number; earnings?: number }[];
  nextEarningsDate?: string;
};

export type MarketSource = "live" | "cache" | "mock" | "none";

export type MarketResult<T> = {
  data: T | null;
  source: MarketSource;
  fetchedAt?: number;
};

// 設定
export type DcfParams = {
  discountRate: number; // 割引率
  terminalGrowth: number; // 永続成長率
  years: number; // 予測年数
  growthCap: number; // 成長率の上限
  growthFloor: number; // 成長率の下限
};

export const DEFAULT_DCF_PARAMS: DcfParams = {
  discountRate: 0.08,
  terminalGrowth: 0.01,
  years: 5,
  growthCap: 0.15,
  growthFloor: -0.05,
};

export type TargetAllocation = Partial<Record<AssetClass, number>>; // % 合計100

export const DEFAULT_TARGET_ALLOCATION: TargetAllocation = {
  stock: 40,
  fund: 30,
  cash: 30,
};

// 配当等にかかる税率（20.315%）
export const DIVIDEND_TAX_RATE = 0.20315;
