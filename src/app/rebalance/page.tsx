import { getPortfolio } from "@/lib/portfolio";
import { getTargetAllocation } from "@/lib/settings";
import { computeRebalance, DRIFT_THRESHOLD_PCT } from "@/lib/rebalance";
import { ASSET_CLASSES, ASSET_CLASS_LABEL } from "@/lib/types";
import { yen, pct } from "@/lib/format";
import { Card, EmptyState, MarketSourceNotice, PageHeader } from "@/components/ui";
import { AllocationCompareBars } from "@/components/charts";
import { saveTargetAllocation } from "./actions";

export const dynamic = "force-dynamic";

export default async function RebalancePage() {
  const portfolio = await getPortfolio();
  const target = getTargetAllocation();
  const result = computeRebalance(portfolio.byClass, target);

  const inputCls =
    "rounded-lg border border-[var(--axis)] bg-white px-2.5 py-1.5 text-sm text-right tabular focus:border-[var(--series-1)] focus:outline-none";
  const targetSum = Object.values(target).reduce((a, b) => a + (b ?? 0), 0);

  return (
    <div>
      <PageHeader
        title="リバランス提案"
        description={`目標の資産配分と現状の乖離を確認し、必要な売買金額を提案します（乖離±${DRIFT_THRESHOLD_PCT}pt超で要リバランス）`}
      />
      <MarketSourceNotice sources={portfolio.marketSources} />

      {portfolio.total <= 0 ? (
        <EmptyState title="資産が登録されていません" />
      ) : (
        <>
          <div
            className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
              result.needsRebalance
                ? "border-amber-300 bg-amber-50 text-amber-800"
                : "border-emerald-200 bg-emerald-50 text-emerald-800"
            }`}
          >
            {result.needsRebalance
              ? `⚖️ 最大 ${result.maxDriftPct.toFixed(1)}pt の乖離があります。下の提案を参考にリバランスを検討してください。`
              : `✅ 資産配分は目標から ±${DRIFT_THRESHOLD_PCT}pt 以内に収まっています（最大乖離 ${result.maxDriftPct.toFixed(1)}pt）。`}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="現在 vs 目標の配分比較">
              <AllocationCompareBars
                data={result.rows.map((r) => ({
                  label: ASSET_CLASS_LABEL[r.assetClass],
                  current: Math.round(r.currentPct * 10) / 10,
                  target: r.targetPct,
                }))}
              />
            </Card>

            <Card title="リバランスに必要な売買">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--grid)] text-left text-xs text-[var(--ink-muted)]">
                    <th className="py-1.5 font-medium">資産クラス</th>
                    <th className="py-1.5 text-right font-medium">現在</th>
                    <th className="py-1.5 text-right font-medium">目標</th>
                    <th className="py-1.5 text-right font-medium">アクション</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((r) => (
                    <tr key={r.assetClass} className="border-b border-[var(--grid)] last:border-0">
                      <td className="py-2 font-medium">{ASSET_CLASS_LABEL[r.assetClass]}</td>
                      <td className="py-2 text-right tabular">
                        {yen(r.current)}
                        <span className="ml-1 text-xs text-[var(--ink-muted)]">({pct(r.currentPct, 1)})</span>
                      </td>
                      <td className="py-2 text-right tabular">
                        {yen(r.targetAmount)}
                        <span className="ml-1 text-xs text-[var(--ink-muted)]">({r.targetPct}%)</span>
                      </td>
                      <td className="py-2 text-right">
                        {Math.abs(r.diff) < portfolio.total * 0.005 ? (
                          <span className="text-xs text-[var(--ink-muted)]">維持でOK</span>
                        ) : r.diff > 0 ? (
                          <span className="font-medium text-[var(--good)]">+{yen(r.diff)} 買い増し</span>
                        ) : (
                          <span className="font-medium text-[var(--bad)]">{yen(r.diff)} 売却/縮小</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-xs text-[var(--ink-muted)]">
                💡 課税を避けたい場合は、売却せずに毎月の積立先を不足クラスに寄せる「ノーセル・リバランス」も有効です。
              </p>
            </Card>
          </div>

          <Card title="目標アセットアロケーションの設定（%）" className="mt-4">
            <form action={saveTargetAllocation} className="flex flex-wrap items-end gap-3">
              {ASSET_CLASSES.map((c) => (
                <label key={c} className="text-xs text-[var(--ink-secondary)]">
                  {ASSET_CLASS_LABEL[c]}
                  <input name={c} defaultValue={target[c] ?? ""} placeholder="0" className={`${inputCls} mt-1 block w-20`} />
                </label>
              ))}
              <button className="rounded-lg bg-[var(--series-1)] px-4 py-1.5 text-sm font-medium text-white hover:opacity-90">
                保存
              </button>
              <span className={`text-xs ${Math.abs(targetSum - 100) > 0.01 ? "text-[var(--bad)]" : "text-[var(--ink-muted)]"}`}>
                現在の合計: {targetSum}%{Math.abs(targetSum - 100) > 0.01 && "（100%になるよう調整してください）"}
              </span>
            </form>
          </Card>
        </>
      )}
    </div>
  );
}
