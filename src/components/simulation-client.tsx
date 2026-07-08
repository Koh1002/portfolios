"use client";

// 積立・FIREシミュレーション（クライアント側で即時再計算）

import { useMemo, useState } from "react";
import { fireTarget, simulate, yearsToTarget } from "@/lib/simulation";
import { SimulationChart } from "@/components/charts";

function yenFmt(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_0000_0000) return `${(v / 1_0000_0000).toFixed(2)}億円`;
  if (abs >= 1_0000) return `${Math.round(v / 1_0000).toLocaleString("ja-JP")}万円`;
  return `${Math.round(v).toLocaleString("ja-JP")}円`;
}

export function SimulationClient({ initialAssets }: { initialAssets: number }) {
  const [initial, setInitial] = useState(Math.round(initialAssets));
  const [monthly, setMonthly] = useState(50000);
  const [returnPct, setReturnPct] = useState(5);
  const [years, setYears] = useState(30);
  const [age, setAge] = useState(30);
  const [fireMode, setFireMode] = useState(true);
  const [annualExpense, setAnnualExpense] = useState(3000000);

  const data = useMemo(
    () => simulate({ initialAssets: initial, monthlyContribution: monthly, annualReturnPct: returnPct, years, currentAge: age }),
    [initial, monthly, returnPct, years, age],
  );
  const target = fireMode ? fireTarget(annualExpense) : null;
  const yearsNeeded = target != null ? yearsToTarget(initial, monthly, returnPct, target) : null;
  const final = data[data.length - 1];

  const inputCls =
    "w-full rounded-lg border border-[var(--axis)] bg-white px-2.5 py-1.5 text-sm text-right tabular focus:border-[var(--series-1)] focus:outline-none";
  const numInput = (value: number, set: (v: number) => void, step = 1) => (
    <input
      type="number"
      value={value}
      step={step}
      onChange={(e) => set(Number(e.target.value) || 0)}
      className={inputCls}
    />
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-[var(--ink-secondary)]">シミュレーション条件</h2>
        <label className="block text-xs text-[var(--ink-secondary)]">
          初期資産（円）※現在の総資産を自動入力
          <div className="mt-1">{numInput(initial, setInitial, 10000)}</div>
        </label>
        <label className="block text-xs text-[var(--ink-secondary)]">
          毎月の積立額（円）
          <div className="mt-1">{numInput(monthly, setMonthly, 5000)}</div>
        </label>
        <label className="block text-xs text-[var(--ink-secondary)]">
          想定利回り（年率%）※全世界株式の長期平均は5〜7%程度
          <div className="mt-1">{numInput(returnPct, setReturnPct, 0.5)}</div>
        </label>
        <label className="block text-xs text-[var(--ink-secondary)]">
          期間（年）
          <div className="mt-1">{numInput(years, setYears)}</div>
        </label>
        <label className="block text-xs text-[var(--ink-secondary)]">
          現在の年齢
          <div className="mt-1">{numInput(age, setAge)}</div>
        </label>
        <div className="border-t border-[var(--grid)] pt-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={fireMode} onChange={(e) => setFireMode(e.target.checked)} />
            FIREモード（4%ルール）
          </label>
          {fireMode && (
            <label className="mt-2 block text-xs text-[var(--ink-secondary)]">
              リタイア後の年間生活費（円）
              <div className="mt-1">{numInput(annualExpense, setAnnualExpense, 100000)}</div>
            </label>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
            <div className="text-xs text-[var(--ink-muted)]">{years}年後（標準）</div>
            <div className="mt-1 text-xl font-bold tabular">{yenFmt(final.standard)}</div>
            <div className="mt-0.5 text-xs text-[var(--ink-secondary)]">
              悲観 {yenFmt(final.pessimistic)} 〜 楽観 {yenFmt(final.optimistic)}
            </div>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
            <div className="text-xs text-[var(--ink-muted)]">投入元本</div>
            <div className="mt-1 text-xl font-bold tabular">{yenFmt(final.principal)}</div>
            <div className="mt-0.5 text-xs text-[var(--good)]">運用益 +{yenFmt(final.standard - final.principal)}</div>
          </div>
          {fireMode && target != null && (
            <>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
                <div className="text-xs text-[var(--ink-muted)]">FIRE目標額（生活費×25）</div>
                <div className="mt-1 text-xl font-bold tabular">{yenFmt(target)}</div>
                <div className="mt-0.5 text-xs text-[var(--ink-secondary)]">年間 {yenFmt(annualExpense)} × 25倍</div>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
                <div className="text-xs text-[var(--ink-muted)]">FIRE達成まで</div>
                <div className="mt-1 text-xl font-bold tabular">
                  {yearsNeeded == null ? "80年超" : yearsNeeded === 0 ? "達成済み🎉" : `約${yearsNeeded}年`}
                </div>
                <div className="mt-0.5 text-xs text-[var(--ink-secondary)]">
                  {yearsNeeded != null && yearsNeeded > 0 && `${Math.round(age + yearsNeeded)}歳ごろ（標準シナリオ）`}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-[var(--ink-secondary)]">
            資産推移予測（悲観 {returnPct - 2}% / 標準 {returnPct}% / 楽観 {returnPct + 2}%）
          </h2>
          <SimulationChart data={data} target={target} />
        </div>
      </div>
    </div>
  );
}
