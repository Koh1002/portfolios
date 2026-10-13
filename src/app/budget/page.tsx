"use client";

import Link from "next/link";
import { usePortfolioData } from "@/lib/use-portfolio";
import { isInvestmentTransfer, transactionCoverage } from "@/lib/derive-series";
import { yen } from "@/lib/format";
import { Card, EmptyState, Loading, PageHeader, StatCard } from "@/components/ui";
import { BudgetBars } from "@/components/charts";

export default function BudgetPage() {
  const { data, ready } = usePortfolioData();
  if (!ready) return <Loading />;

  const rows = data.transactions;

  const byMonth = new Map<string, { income: number; expense: number }>();
  for (const r of rows) {
    const key = r.date.slice(0, 7);
    const m = byMonth.get(key) ?? { income: 0, expense: 0 };
    if (r.amount >= 0) m.income += r.amount;
    else m.expense += -r.amount;
    byMonth.set(key, m);
  }
  const months = Array.from(byMonth.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12);

  const latestMonth = months.length > 0 ? months[months.length - 1][0] : null;
  const catMap = new Map<string, number>();
  if (latestMonth) {
    for (const r of rows) {
      if (r.date.startsWith(latestMonth) && r.amount < 0) {
        catMap.set(r.category, (catMap.get(r.category) ?? 0) + -r.amount);
      }
    }
  }
  const categories = Array.from(catMap.entries()).sort((a, b) => b[1] - a[1]);
  const latest = latestMonth ? byMonth.get(latestMonth)! : null;

  // 取込カバレッジと直近月の投資振替（積立）額
  const coverage = transactionCoverage(rows);
  const latestInvest = latestMonth
    ? rows
        .filter((r) => r.date.startsWith(latestMonth) && r.amount < 0 && isInvestmentTransfer(r.category))
        .reduce((s, r) => s + -r.amount, 0)
    : 0;

  return (
    <div>
      <PageHeader
        title="収支サマリー"
        description="マネーフォワードMEの家計簿CSV（収入・支出詳細）から月別の収支を集計します"
      />

      {rows.length === 0 ? (
        <EmptyState title="収支データがありません">
          <Link href="/import" className="text-[var(--series-1)] underline">CSVインポート</Link> からマネーフォワードMEの家計簿CSVを取り込んでください
        </EmptyState>
      ) : (
        <>
          <div
            className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
              coverage.missing.length > 0
                ? "border-amber-300 bg-amber-50 text-amber-800"
                : "border-emerald-200 bg-emerald-50 text-emerald-800"
            }`}
          >
            📥 取込済みの入出金明細: <strong>{coverage.months[0]?.replace("-", "/")}〜{coverage.months[coverage.months.length - 1]?.replace("-", "/")}</strong>
            （{coverage.months.length}ヶ月分）
            {coverage.missing.length > 0 ? (
              <>
                {" "}／ ⚠️ 未取込の月: <strong>{coverage.missing.map((m) => m.replace("-", "/")).join("・")}</strong>
                — 歯抜けがあると資産推移の推計が不正確になります。該当月のCSVを追加インポートしてください。
              </>
            ) : (
              " ／ 歯抜けなし ✅"
            )}
            {latestInvest > 0 && (
              <>
                <br />💹 直近月の積立（貯金・投資カテゴリ）: <strong>{yen(latestInvest)}</strong>
                — 資産推移では現金→投資信託への振替として扱われます（総資産は減りません）
              </>
            )}
          </div>
          {latest && (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard label={`${latestMonth!.replace("-", "年")}月の収入`} value={yen(latest.income)} tone="good" />
              <StatCard label={`${latestMonth!.replace("-", "年")}月の支出`} value={yen(latest.expense)} tone="bad" />
              <StatCard
                label="収支"
                value={yen(latest.income - latest.expense, { signed: true })}
                tone={latest.income - latest.expense >= 0 ? "good" : "bad"}
              />
              <StatCard
                label="貯蓄率"
                value={latest.income > 0 ? `${(((latest.income - latest.expense) / latest.income) * 100).toFixed(0)}%` : "−"}
                sub="（収入−支出）÷収入"
              />
            </div>
          )}

          <Card title="月別の収入と支出（直近12ヶ月）" className="mt-4">
            <BudgetBars
              data={months.map(([label, m]) => ({
                label: label.slice(2).replace("-", "/"),
                income: Math.round(m.income),
                expense: Math.round(m.expense),
              }))}
            />
          </Card>

          {categories.length > 0 && (
            <Card title={`${latestMonth!.replace("-", "年")}月の支出カテゴリ内訳`} className="mt-4">
              <div className="space-y-2">
                {categories.map(([cat, amount]) => {
                  const total = latest!.expense || 1;
                  const w = (amount / total) * 100;
                  return (
                    <div key={cat} className="flex items-center gap-3 text-sm">
                      <span className="w-32 shrink-0 truncate">{cat}</span>
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--grid)]">
                        <div className="h-full rounded-full bg-[var(--series-6)]" style={{ width: `${w}%` }} />
                      </div>
                      <span className="w-28 text-right tabular text-xs text-[var(--ink-secondary)]">{yen(amount)}</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
