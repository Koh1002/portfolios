// リバランス提案（純粋関数）
// 現在の資産クラス別金額と目標配分（%）から、乖離と必要な売買金額を計算する。

import type { AssetClass, TargetAllocation } from "./types";

export type RebalanceRow = {
  assetClass: AssetClass;
  current: number;
  currentPct: number;
  targetPct: number;
  targetAmount: number;
  diff: number; // 正: 買い増しが必要 / 負: 売却（比率引き下げ）が必要
  diffPct: number; // 現在比率 − 目標比率（ポイント）
};

export type RebalanceResult = {
  rows: RebalanceRow[];
  total: number;
  maxDriftPct: number; // 最大乖離（ポイント）
  needsRebalance: boolean; // 乖離が閾値超
};

export const DRIFT_THRESHOLD_PCT = 5;

export function computeRebalance(
  current: Partial<Record<AssetClass, number>>,
  target: TargetAllocation,
): RebalanceResult {
  const total = Object.values(current).reduce((a, b) => a + (b ?? 0), 0);
  const classes = new Set<AssetClass>([
    ...(Object.keys(current) as AssetClass[]),
    ...(Object.keys(target) as AssetClass[]),
  ]);

  const rows: RebalanceRow[] = [];
  for (const c of classes) {
    const cur = current[c] ?? 0;
    const targetPct = target[c] ?? 0;
    if (cur === 0 && targetPct === 0) continue;
    const currentPct = total > 0 ? (cur / total) * 100 : 0;
    const targetAmount = (total * targetPct) / 100;
    rows.push({
      assetClass: c,
      current: cur,
      currentPct,
      targetPct,
      targetAmount,
      diff: targetAmount - cur,
      diffPct: currentPct - targetPct,
    });
  }
  rows.sort((a, b) => b.current - a.current);
  const maxDriftPct = rows.reduce((m, r) => Math.max(m, Math.abs(r.diffPct)), 0);
  return { rows, total, maxDriftPct, needsRebalance: maxDriftPct > DRIFT_THRESHOLD_PCT };
}
