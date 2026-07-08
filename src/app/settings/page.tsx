import { getDcfParams } from "@/lib/settings";
import { Card, PageHeader } from "@/components/ui";
import { saveDcfParams } from "./actions";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const p = getDcfParams();
  const inputCls =
    "rounded-lg border border-[var(--axis)] bg-white px-2.5 py-1.5 text-sm text-right tabular focus:border-[var(--series-1)] focus:outline-none";

  return (
    <div>
      <PageHeader title="設定" description="理論株価計算（DCF法）のパラメータ" />

      <Card title="DCFパラメータ" className="max-w-2xl">
        <form action={saveDcfParams} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <label className="text-xs text-[var(--ink-secondary)]">
              割引率（%）— 株式に要求するリターン。一般に7〜10%
              <input name="discountRate" defaultValue={p.discountRate * 100} className={`${inputCls} mt-1 block w-full`} />
            </label>
            <label className="text-xs text-[var(--ink-secondary)]">
              永続成長率（%）— 予測期間後の成長率。0〜2%が保守的
              <input name="terminalGrowth" defaultValue={p.terminalGrowth * 100} className={`${inputCls} mt-1 block w-full`} />
            </label>
            <label className="text-xs text-[var(--ink-secondary)]">
              予測年数（年）
              <input name="years" defaultValue={p.years} className={`${inputCls} mt-1 block w-full`} />
            </label>
            <label className="text-xs text-[var(--ink-secondary)]">
              成長率の上限（%）— 楽観的な予想をキャップ
              <input name="growthCap" defaultValue={p.growthCap * 100} className={`${inputCls} mt-1 block w-full`} />
            </label>
            <label className="text-xs text-[var(--ink-secondary)]">
              成長率の下限（%）
              <input name="growthFloor" defaultValue={p.growthFloor * 100} className={`${inputCls} mt-1 block w-full`} />
            </label>
          </div>
          <button className="rounded-lg bg-[var(--series-1)] px-4 py-2 text-sm font-medium text-white hover:opacity-90">
            保存
          </button>
        </form>
        <p className="mt-4 text-xs leading-relaxed text-[var(--ink-muted)]">
          割引率を上げるほど理論株価は低く（判定が厳しく）なります。
          目標アセットアロケーションは <a href="/rebalance" className="text-[var(--series-1)] underline">リバランス</a> ページで設定できます。
        </p>
      </Card>
    </div>
  );
}
