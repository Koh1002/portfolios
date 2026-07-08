"use client";

import Link from "next/link";
import { usePortfolio } from "@/lib/use-portfolio";
import { summarizeDividends } from "@/lib/dividends";
import { exMonthsFor } from "@/data/stock-universe";
import { yen, pct } from "@/lib/format";
import { Card, EmptyState, Loading, MarketSourceNotice, PageHeader, StatCard } from "@/components/ui";
import { DividendBars } from "@/components/charts";
import { DIVIDEND_TAX_RATE } from "@/lib/types";

const MONTH_LABEL = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];

export default function DividendsPage() {
  const { ready, portfolio, marketDateLabel } = usePortfolio();
  if (!ready) return <Loading />;

  const summary = summarizeDividends(
    portfolio.stockHoldings.map((h) => ({
      ticker: h.ticker!,
      name: h.name,
      quantity: h.quantity,
      dividendRate: h.quote?.dividendRate,
      exMonths: exMonthsFor(h.ticker),
      taxable: h.nisa === "none",
      avgCost: h.avgCost ?? undefined,
    })),
  );

  const chartData = summary.monthly.map((m) => ({
    label: MONTH_LABEL[m.month - 1],
    net: Math.round(m.net),
    tax: Math.round(m.gross - m.net),
  }));

  const totalStockValue = portfolio.stockHoldings.reduce((s, h) => s + h.value, 0);

  return (
    <div>
      <PageHeader
        title="配当カレンダー"
        description="保有株の年間予想配当と月別の受取スケジュール（受取月 = 権利確定月 + 約3ヶ月で推計）"
      />
      <MarketSourceNotice sources={portfolio.marketSources} dateLabel={marketDateLabel} />

      {summary.perStock.length === 0 ? (
        <EmptyState title="配当のある保有株がありません">
          <Link href="/accounts" className="text-[var(--series-1)] underline">口座・資産</Link> で証券コード付きの株式を登録すると配当予測が表示されます
        </EmptyState>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="年間予想配当（税引前）" value={yen(summary.annualGross)} />
            <StatCard
              label="年間予想配当（手取り）"
              value={yen(summary.annualNet)}
              sub={`税率 ${(DIVIDEND_TAX_RATE * 100).toFixed(3)}%（NISA分は非課税）`}
              tone="good"
            />
            <StatCard label="月あたり平均" value={yen(summary.annualNet / 12)} sub="手取りベース" />
            <StatCard
              label="ポートフォリオ利回り"
              value={totalStockValue > 0 ? pct((summary.annualGross / totalStockValue) * 100, 2) : "−"}
              sub="株式評価額に対する税引前利回り"
            />
          </div>

          <Card title="月別の配当受取予定" className="mt-4">
            <DividendBars data={chartData} />
          </Card>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card title="銘柄別の年間配当">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--grid)] text-left text-xs text-[var(--ink-muted)]">
                    <th className="py-1.5 font-medium">銘柄</th>
                    <th className="py-1.5 text-right font-medium">年間配当（税引前）</th>
                    <th className="py-1.5 text-right font-medium">手取り</th>
                    <th className="py-1.5 text-right font-medium">取得利回り(YOC)</th>
                    <th className="py-1.5 text-right font-medium">受取月</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.perStock.map((s) => (
                    <tr key={s.ticker} className="border-b border-[var(--grid)] last:border-0">
                      <td className="py-2">
                        <Link href={`/stocks/detail?t=${s.ticker}`} className="font-medium hover:underline">{s.name}</Link>
                        <span className="ml-1.5 text-xs text-[var(--ink-muted)]">{s.ticker}</span>
                      </td>
                      <td className="py-2 text-right tabular">{yen(s.annualGross)}</td>
                      <td className="py-2 text-right tabular">{yen(s.annualNet)}</td>
                      <td className="py-2 text-right tabular">{s.yieldOnCost != null ? pct(s.yieldOnCost, 2) : "−"}</td>
                      <td className="py-2 text-right text-xs text-[var(--ink-secondary)]">
                        {s.payMonths.map((m) => `${m}月`).join("・")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            <Card title="月別の内訳">
              <div className="space-y-2">
                {summary.monthly
                  .filter((m) => m.gross > 0)
                  .map((m) => (
                    <div key={m.month} className="flex items-baseline justify-between border-b border-[var(--grid)] pb-2 text-sm last:border-0">
                      <div>
                        <span className="font-medium">{MONTH_LABEL[m.month - 1]}</span>
                        <span className="ml-2 text-xs text-[var(--ink-secondary)]">
                          {m.items.map((i) => i.name).join("・")}
                        </span>
                      </div>
                      <span className="tabular font-medium">{yen(m.net)}</span>
                    </div>
                  ))}
              </div>
            </Card>
          </div>
        </>
      )}

      <p className="mt-4 text-xs text-[var(--ink-muted)]">
        予想配当は直近の年間1株配当 × 保有数で計算した概算です。実際の受取月・金額は各社の配当方針により変動します。
      </p>
    </div>
  );
}
