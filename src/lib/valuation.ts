// 理論株価エンジン（純粋関数・ユニットテスト対象）
// DCF法・PER法・配当割引モデル(DDM)の3手法で理論株価を計算し、
// 加重平均した理論株価と現在株価の乖離から5段階の割安/割高判定を行う。

import type { DcfParams, Fundamentals, QuoteData, Verdict } from "./types";
import { DEFAULT_DCF_PARAMS } from "./types";

export type DcfResult = {
  fairValue: number;
  baseFcf: number;
  usedGrowth: number;
  growthSource: string;
  projection: { year: number; fcf: number; pv: number }[];
  terminalValue: number;
  terminalPv: number;
  enterpriseValue: number;
  netDebt: number;
  equityValue: number;
};

export type PerResult = {
  fairValue: number;
  usedEps: number;
  epsSource: string;
  usedPer: number;
};

export type DdmResult = {
  fairValue: number;
  dividend: number;
  usedGrowth: number;
};

export type ValuationResult = {
  fairValue: number | null;
  price: number;
  ratio: number | null; // 現在株価 ÷ 理論株価（1未満なら割安）
  upsidePct: number | null; // 理論株価までの上昇余地
  verdict: Verdict | null;
  dcf: DcfResult | null;
  per: PerResult | null;
  ddm: DdmResult | null;
  weights: { dcf: number; per: number; ddm: number };
};

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

// FCF実績の平均成長率（CAGR）。データ不足時は undefined。
export function fcfCagr(fcfHistory: { fcf?: number }[] | undefined): number | undefined {
  const values = (fcfHistory ?? []).map((h) => h.fcf).filter((v): v is number => v != null && v > 0);
  if (values.length < 2) return undefined;
  const first = values[0];
  const last = values[values.length - 1];
  const years = values.length - 1;
  return Math.pow(last / first, 1 / years) - 1;
}

// DCF法: FCFを成長率で予測 → 割引率で現在価値化 → 純有利子負債を控除して1株価値
export function computeDcf(
  quote: QuoteData,
  fund: Fundamentals,
  params: DcfParams = DEFAULT_DCF_PARAMS,
): DcfResult | null {
  const shares = quote.sharesOutstanding;
  if (!shares || shares <= 0) return null;

  // ベースFCF: 直近実績と過去平均の保守的な方（なければ financialData の freeCashflow）
  const histFcfs = (fund.fcfHistory ?? []).map((h) => h.fcf).filter((v): v is number => v != null);
  let baseFcf: number | undefined;
  if (histFcfs.length > 0) {
    const latest = histFcfs[histFcfs.length - 1];
    const avg = histFcfs.reduce((a, b) => a + b, 0) / histFcfs.length;
    baseFcf = Math.min(latest, avg) > 0 ? Math.min(latest, avg) : Math.max(latest, avg);
  } else if (fund.freeCashflow != null) {
    baseFcf = fund.freeCashflow;
  }
  if (baseFcf == null || baseFcf <= 0) return null; // FCFが赤字の企業はDCF対象外

  // 成長率: アナリスト予想と実績CAGRの保守的な方。上下限でキャップ。
  const candidates: { g: number; label: string }[] = [];
  if (fund.earningsGrowth != null) candidates.push({ g: fund.earningsGrowth, label: "アナリスト予想" });
  const hist = fcfCagr(fund.fcfHistory);
  if (hist != null) candidates.push({ g: hist, label: "FCF実績CAGR" });
  if (fund.revenueGrowth != null && candidates.length === 0)
    candidates.push({ g: fund.revenueGrowth, label: "売上成長率" });
  const chosen =
    candidates.length > 0
      ? candidates.reduce((a, b) => (a.g < b.g ? a : b))
      : { g: 0.02, label: "デフォルト(2%)" };
  const usedGrowth = clamp(chosen.g, params.growthFloor, params.growthCap);

  const r = params.discountRate;
  const projection: { year: number; fcf: number; pv: number }[] = [];
  let pvSum = 0;
  let fcf = baseFcf;
  for (let y = 1; y <= params.years; y++) {
    fcf = fcf * (1 + usedGrowth);
    const pv = fcf / Math.pow(1 + r, y);
    projection.push({ year: y, fcf, pv });
    pvSum += pv;
  }
  const g = Math.min(params.terminalGrowth, r - 0.01); // r > g を保証
  const terminalValue = (fcf * (1 + g)) / (r - g);
  const terminalPv = terminalValue / Math.pow(1 + r, params.years);

  const netDebt = (fund.totalDebt ?? 0) - (fund.totalCash ?? 0);
  const enterpriseValue = pvSum + terminalPv;
  const equityValue = enterpriseValue - netDebt;
  if (equityValue <= 0) return null;

  return {
    fairValue: equityValue / shares,
    baseFcf,
    usedGrowth,
    growthSource: chosen.label,
    projection,
    terminalValue,
    terminalPv,
    enterpriseValue,
    netDebt,
    equityValue,
  };
}

// PER法: EPS × 妥当PER。妥当PERは実績PERと予想PERの平均（8〜25でキャップ）。
export function computePer(quote: QuoteData): PerResult | null {
  const eps = quote.epsForward ?? quote.epsTrailing;
  if (eps == null || eps <= 0) return null;
  const pers = [quote.trailingPE, quote.forwardPE].filter(
    (v): v is number => v != null && v > 0 && isFinite(v),
  );
  const rawPer = pers.length > 0 ? pers.reduce((a, b) => a + b, 0) / pers.length : 15;
  const usedPer = clamp(rawPer, 8, 25);
  return {
    fairValue: eps * usedPer,
    usedEps: eps,
    epsSource: quote.epsForward != null ? "予想EPS" : "実績EPS",
    usedPer,
  };
}

// 配当割引モデル(DDM/ゴードンモデル): D1 ÷ (r - g)
export function computeDdm(
  quote: QuoteData,
  fund: Fundamentals,
  params: DcfParams = DEFAULT_DCF_PARAMS,
): DdmResult | null {
  const d = quote.dividendRate;
  if (d == null || d <= 0) return null;
  // 配当性向が高すぎる（>90%）場合は持続性に疑問があるため対象外
  if (fund.payoutRatio != null && fund.payoutRatio > 0.9) return null;
  const g = clamp(Math.min(fund.earningsGrowth ?? 0.02, 0.03), 0, 0.03);
  const r = params.discountRate;
  if (r <= g) return null;
  return { fairValue: (d * (1 + g)) / (r - g), dividend: d, usedGrowth: g };
}

export function verdictFromRatio(ratio: number): Verdict {
  if (ratio <= 0.75) return "割安";
  if (ratio <= 0.9) return "やや割安";
  if (ratio <= 1.1) return "適正";
  if (ratio <= 1.3) return "やや割高";
  return "割高";
}

// 3手法の加重平均で総合理論株価を算出（欠けた手法の重みは再配分）
export function computeValuation(
  quote: QuoteData,
  fund: Fundamentals,
  params: DcfParams = DEFAULT_DCF_PARAMS,
): ValuationResult {
  const dcf = computeDcf(quote, fund, params);
  const per = computePer(quote);
  const ddm = computeDdm(quote, fund, params);

  const baseWeights = { dcf: 0.5, per: 0.3, ddm: 0.2 };
  const entries: { key: keyof typeof baseWeights; fair: number }[] = [];
  if (dcf) entries.push({ key: "dcf", fair: dcf.fairValue });
  if (per) entries.push({ key: "per", fair: per.fairValue });
  if (ddm) entries.push({ key: "ddm", fair: ddm.fairValue });

  const weights = { dcf: 0, per: 0, ddm: 0 };
  let fairValue: number | null = null;
  if (entries.length > 0 && quote.price > 0) {
    const totalW = entries.reduce((s, e) => s + baseWeights[e.key], 0);
    let acc = 0;
    for (const e of entries) {
      const w = baseWeights[e.key] / totalW;
      weights[e.key] = w;
      acc += e.fair * w;
    }
    fairValue = acc;
  }

  const ratio = fairValue != null && fairValue > 0 ? quote.price / fairValue : null;
  return {
    fairValue,
    price: quote.price,
    ratio,
    upsidePct: fairValue != null && quote.price > 0 ? ((fairValue - quote.price) / quote.price) * 100 : null,
    verdict: ratio != null ? verdictFromRatio(ratio) : null,
    dcf,
    per,
    ddm,
    weights,
  };
}

export const VERDICT_COLOR: Record<Verdict, string> = {
  割安: "bg-emerald-100 text-emerald-800 border-emerald-300",
  やや割安: "bg-teal-50 text-teal-700 border-teal-200",
  適正: "bg-slate-100 text-slate-700 border-slate-300",
  やや割高: "bg-amber-50 text-amber-700 border-amber-300",
  割高: "bg-rose-100 text-rose-800 border-rose-300",
};
