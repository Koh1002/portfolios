// 資産推移の推計エンジン（純粋関数）
// マネーフォワードME無料版は「月ごとの入出金明細CSV」しか出力できないため、
// 「どこかの断面の資産状況（実測スナップショット）」+「入出金明細の積み上げ」から
// 各月末の資産状況を推計する。
//
// - 実測点（スナップショット）はそのまま採用
// - 実測点がない月末は、時間的に最も近い実測点を基準に入出金を積み上げ/巻き戻して現金残高を推計
// - 「貯金・投資」系カテゴリの支出は現金→投資信託への資産内移動として扱う（総資産は減らない）
// - 株価・基準価額の市場変動は推計に含めない（次の実測点で補正される）

import type { Snapshot, Transaction } from "./store";

// 投資への振替として扱う大項目のキーワード（支出額ぶん現金→fundへ移動）
export const INVESTMENT_CATEGORIES = ["貯金・投資", "投資", "財形", "積立", "資産形成"];

export function isInvestmentTransfer(category: string): boolean {
  return INVESTMENT_CATEGORIES.some((kw) => category.includes(kw));
}

export type SeriesPoint = {
  date: string; // YYYY-MM-DD
  total: number;
  byClass: Record<string, number>;
  derived: boolean; // true = 入出金からの推計値
};

// 月末日（YYYY-MM-DD）
export function monthEnd(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${ym}-${String(last).padStart(2, "0")}`;
}

// 期間 (from, to] の入出金を集計 → { cashDelta, investDelta }
function sumFlows(
  transactions: Transaction[],
  from: string,
  to: string,
): { cashDelta: number; investDelta: number } {
  let cashDelta = 0;
  let investDelta = 0;
  for (const t of transactions) {
    if (t.date <= from || t.date > to) continue;
    if (t.amount < 0 && isInvestmentTransfer(t.category)) {
      // 投資振替: 現金が減り、同額だけ投資クラスが増える
      cashDelta += t.amount;
      investDelta += -t.amount;
    } else {
      cashDelta += t.amount;
    }
  }
  return { cashDelta, investDelta };
}

// 実測スナップショットを日付ごとの断面にまとめる
function groupSnapshots(snapshots: Snapshot[]): { date: string; byClass: Record<string, number> }[] {
  const byDate = new Map<string, Record<string, number>>();
  for (const s of snapshots) {
    const entry = byDate.get(s.date) ?? {};
    entry[s.category] = (entry[s.category] ?? 0) + s.amount;
    byDate.set(s.date, entry);
  }
  return Array.from(byDate.entries())
    .map(([date, byClass]) => ({ date, byClass }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function totalOf(byClass: Record<string, number>): number {
  return Object.values(byClass).reduce((a, b) => a + b, 0);
}

// 基準断面から from→to へ入出金を反映した断面を作る（to > from なら前方、to < from なら後方）
function project(
  base: Record<string, number>,
  transactions: Transaction[],
  from: string,
  to: string,
): Record<string, number> {
  const result = { ...base };
  const flows =
    to > from
      ? sumFlows(transactions, from, to)
      : (() => {
          const f = sumFlows(transactions, to, from);
          return { cashDelta: -f.cashDelta, investDelta: -f.investDelta };
        })();
  result.cash = (result.cash ?? 0) + flows.cashDelta;
  result.fund = (result.fund ?? 0) + flows.investDelta;
  // 丸め誤差回避と見た目のため整数化
  for (const k of Object.keys(result)) result[k] = Math.round(result[k]);
  return result;
}

// メイン: 実測スナップショット + 入出金明細 → 月次の資産推移（実測+推計）
export function deriveAssetSeries(
  snapshots: Snapshot[],
  transactions: Transaction[],
): SeriesPoint[] {
  const anchors = groupSnapshots(snapshots);
  if (anchors.length === 0) return []; // 断面が1つもなければ推計不能

  // 推計対象の月末: 入出金明細がカバーする全月 + 実測点のある月
  const months = new Set<string>();
  for (const t of transactions) months.add(t.date.slice(0, 7));
  for (const a of anchors) months.add(a.date.slice(0, 7));

  const points = new Map<string, SeriesPoint>();

  // 実測点（そのまま採用）
  for (const a of anchors) {
    points.set(a.date, { date: a.date, byClass: a.byClass, total: totalOf(a.byClass), derived: false });
  }

  // 各月末の推計点
  for (const ym of months) {
    const date = monthEnd(ym);
    if (points.has(date)) continue;
    // 時間的に最も近い実測点を基準にする
    let nearest = anchors[0];
    let bestDist = Infinity;
    for (const a of anchors) {
      const dist = Math.abs(Date.parse(a.date) - Date.parse(date));
      if (dist < bestDist) {
        bestDist = dist;
        nearest = a;
      }
    }
    const byClass = project(nearest.byClass, transactions, nearest.date, date);
    points.set(date, { date, byClass, total: totalOf(byClass), derived: true });
  }

  return Array.from(points.values()).sort((a, b) => a.date.localeCompare(b.date));
}

// 取り込み済みの月の一覧と歯抜けチェック
export function transactionCoverage(transactions: Transaction[]): {
  months: string[]; // 取込済みの月（YYYY-MM、昇順）
  missing: string[]; // 範囲内で欠けている月
} {
  const set = new Set(transactions.map((t) => t.date.slice(0, 7)));
  const months = Array.from(set).sort();
  const missing: string[] = [];
  if (months.length >= 2) {
    const [firstY, firstM] = months[0].split("-").map(Number);
    const [lastY, lastM] = months[months.length - 1].split("-").map(Number);
    for (let y = firstY, m = firstM; y < lastY || (y === lastY && m <= lastM); m === 12 ? (y++, m = 1) : m++) {
      const ym = `${y}-${String(m).padStart(2, "0")}`;
      if (!set.has(ym)) missing.push(ym);
    }
  }
  return { months, missing };
}
