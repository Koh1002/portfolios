// 積立・FIREシミュレーション（純粋関数）

export type SimulationPoint = {
  year: number; // 経過年数
  age?: number;
  pessimistic: number;
  standard: number;
  optimistic: number;
  principal: number; // 元本（初期資産 + 積立累計）
};

export type SimulationInput = {
  initialAssets: number;
  monthlyContribution: number;
  annualReturnPct: number; // 標準シナリオの想定利回り（%）
  years: number;
  currentAge?: number;
};

// 月次複利で将来資産を計算
export function projectAssets(
  initial: number,
  monthly: number,
  annualReturnPct: number,
  years: number,
): number[] {
  const r = annualReturnPct / 100 / 12;
  const result: number[] = [initial];
  let v = initial;
  for (let m = 1; m <= years * 12; m++) {
    v = v * (1 + r) + monthly;
    if (m % 12 === 0) result.push(v);
  }
  return result;
}

export function simulate(input: SimulationInput): SimulationPoint[] {
  const { initialAssets, monthlyContribution, annualReturnPct, years, currentAge } = input;
  const spread = 2; // 悲観/楽観は ±2%
  const pes = projectAssets(initialAssets, monthlyContribution, annualReturnPct - spread, years);
  const std = projectAssets(initialAssets, monthlyContribution, annualReturnPct, years);
  const opt = projectAssets(initialAssets, monthlyContribution, annualReturnPct + spread, years);
  return std.map((_, i) => ({
    year: i,
    age: currentAge != null ? currentAge + i : undefined,
    pessimistic: Math.round(pes[i]),
    standard: Math.round(std[i]),
    optimistic: Math.round(opt[i]),
    principal: Math.round(initialAssets + monthlyContribution * 12 * i),
  }));
}

// FIRE目標額（4%ルール: 年間生活費 ÷ 0.04 = 25倍）
export function fireTarget(annualExpense: number): number {
  return annualExpense * 25;
}

// 標準シナリオで目標額に到達する年数（最大80年、届かなければ null）
export function yearsToTarget(
  initial: number,
  monthly: number,
  annualReturnPct: number,
  target: number,
): number | null {
  if (initial >= target) return 0;
  const r = annualReturnPct / 100 / 12;
  let v = initial;
  for (let m = 1; m <= 80 * 12; m++) {
    v = v * (1 + r) + monthly;
    if (v >= target) return Math.ceil(m / 12 * 10) / 10;
  }
  return null;
}
