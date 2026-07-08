import { asc } from "drizzle-orm";
import { db, transactions } from "@/db";
import { yen } from "@/lib/format";
import Link from "next/link";
import { Card, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { BudgetBars } from "@/components/charts";

export const dynamic = "force-dynamic";

export default function BudgetPage() {
  const rows = db.select().from(transactions).orderBy(asc(transactions.date)).all();

  // 月別集計
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

  // 直近月のカテゴリ内訳
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
