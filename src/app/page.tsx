"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePortfolio } from "@/lib/use-portfolio";
import { computeValuation } from "@/lib/valuation";
import { computeRebalance } from "@/lib/rebalance";
import { summarizeDividends } from "@/lib/dividends";
import { exMonthsFor } from "@/data/stock-universe";
import { buildSampleData } from "@/data/sample-data";
import { replaceAllData } from "@/lib/store";
import { ASSET_CLASS_LABEL, type AssetClass } from "@/lib/types";
import { yen, yenCompact, pct } from "@/lib/format";
import { Card, EmptyState, Loading, MarketSourceNotice, PageHeader, StatCard, VerdictBadge } from "@/components/ui";
import { BreakdownPie, TrendChart } from "@/components/charts";

export default function DashboardPage() {
  const { ready, portfolio, series, data, marketDateLabel, getFundamentals } = usePortfolio();

  const judged = useMemo(() => {
    return portfolio.stockHoldings
      .map((h) => {
        if (!h.quote || !h.ticker) return null;
        const fund = getFundamentals(h.ticker, h.name);
        if (!fund.data) return null;
        return { holding: h, valuation: computeValuation(h.quote, fund.data, data.settings.dcfParams) };
      })
      .filter((v): v is NonNullable<typeof v> => v != null && v.valuation.verdict != null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portfolio, data.settings.dcfParams]);

  if (!ready) return <Loading />;

  const undervalued = judged.filter((v) => v.valuation.verdict === "割安" || v.valuation.verdict === "やや割安");
  const overvalued = judged.filter((v) => v.valuation.verdict === "割高" || v.valuation.verdict === "やや割高");

  const rebalance = computeRebalance(portfolio.byClass, data.settings.targetAllocation);

  const divSummary = summarizeDividends(
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
  const currentMonth = new Date().getMonth() + 1;
  const thisMonthDiv = divSummary.monthly[currentMonth - 1];

  // 前月比（スナップショットから約1ヶ月前を探す）
  let momChange: number | null = null;
  if (series.length >= 2) {
    const latest = series[series.length - 1];
    const target = new Date(latest.date);
    target.setMonth(target.getMonth() - 1);
    const targetStr = target.toISOString().slice(0, 10);
    const prev = [...series].reverse().find((s) => s.date <= targetStr) ?? series[0];
    if (prev && prev.total > 0) momChange = latest.total - prev.total;
  }

  const classData = Object.entries(portfolio.byClass)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => ({ key: k, name: ASSET_CLASS_LABEL[k as AssetClass], value: Math.round(v) }));
  const accountData = portfolio.byAccount
    .filter((a) => a.total > 0)
    .map((a) => ({ name: a.name, value: Math.round(a.total) }));

  const hasData = portfolio.holdings.length > 0;

  return (
    <div>
      <PageHeader title="ダッシュボード" description="資産全体のサマリー（データはこの端末のブラウザ内にのみ保存されます）" />
      <MarketSourceNotice sources={portfolio.marketSources} dateLabel={marketDateLabel} />

      {!hasData ? (
        <EmptyState title="まだ資産が登録されていません">
          <div className="space-y-3">
            <p>
              <Link href="/accounts" className="text-[var(--series-1)] underline">口座・資産の登録</Link> または{" "}
              <Link href="/import" className="text-[var(--series-1)] underline">CSVインポート</Link> から始めましょう
            </p>
            <button
              onClick={() => replaceAllData(buildSampleData())}
              className="rounded-lg bg-[var(--series-1)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              サンプルデータを読み込んで試す
            </button>
          </div>
        </EmptyState>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="総資産" value={yen(portfolio.total)} sub={`${portfolio.holdings.length}件の資産`} />
            <StatCard
              label="前月比"
              value={momChange != null ? yen(momChange, { signed: true }) : "−"}
              sub={momChange == null ? "スナップショットを蓄積すると表示されます" : undefined}
              tone={momChange == null ? "neutral" : momChange >= 0 ? "good" : "bad"}
            />
            <StatCard
              label="評価損益"
              value={yen(portfolio.totalGain, { signed: true })}
              tone={portfolio.totalGain >= 0 ? "good" : "bad"}
              sub={portfolio.totalCost > 0 ? pct((portfolio.totalGain / portfolio.totalCost) * 100, 1, { signed: true }) : undefined}
            />
            <StatCard
              label="年間予想配当（手取り）"
              value={yen(divSummary.annualNet)}
              sub={`税引前 ${yen(divSummary.annualGross)}`}
            />
          </div>

          {(rebalance.needsRebalance || undervalued.length > 0 || overvalued.length > 0 || thisMonthDiv.gross > 0) && (
            <Card title="アラート・お知らせ" className="mt-4">
              <ul className="space-y-1.5 text-sm">
                {rebalance.needsRebalance && (
                  <li>
                    ⚖️ 資産配分が目標から最大 <strong>{rebalance.maxDriftPct.toFixed(1)}pt</strong> 乖離しています →{" "}
                    <Link href="/rebalance" className="text-[var(--series-1)] underline">リバランス提案を見る</Link>
                  </li>
                )}
                {undervalued.length > 0 && (
                  <li>
                    📉 保有株のうち <strong>{undervalued.length}銘柄</strong> が理論株価より割安と判定されています（買い増し検討）
                  </li>
                )}
                {overvalued.length > 0 && (
                  <li>
                    📈 保有株のうち <strong>{overvalued.length}銘柄</strong> が割高と判定されています（利益確定検討）
                  </li>
                )}
                {thisMonthDiv.gross > 0 && (
                  <li>
                    💰 今月は約 <strong>{yenCompact(thisMonthDiv.net)}</strong> の配当受取予定があります（
                    {thisMonthDiv.items.map((i) => i.name).slice(0, 3).join("・")}
                    {thisMonthDiv.items.length > 3 ? " ほか" : ""}）
                  </li>
                )}
              </ul>
            </Card>
          )}

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card title="資産推移">
              {series.length >= 2 ? (
                <TrendChart data={series.map((s) => ({ date: s.date, total: Math.round(s.total) }))} />
              ) : (
                <p className="py-10 text-center text-sm text-[var(--ink-muted)]">
                  スナップショットが2件以上たまると推移グラフが表示されます。<br />
                  CSVインポートまたは口座ページの「スナップショット記録」で蓄積できます。
                </p>
              )}
            </Card>
            <Card title="資産クラス別内訳">
              <BreakdownPie data={classData} />
            </Card>
            <Card title="口座別内訳">
              <BreakdownPie data={accountData} />
            </Card>
            <Card title="保有株の割安/割高判定">
              {judged.length === 0 ? (
                <p className="py-10 text-center text-sm text-[var(--ink-muted)]">ティッカー付きの保有株を登録すると表示されます</p>
              ) : (
                <table className="w-full text-sm">
                  <tbody>
                    {[...judged]
                      .sort((a, b) => (a.valuation.ratio ?? 1) - (b.valuation.ratio ?? 1))
                      .slice(0, 6)
                      .map(({ holding, valuation }) => (
                        <tr key={holding.id} className="border-b border-[var(--grid)] last:border-0">
                          <td className="py-2">
                            <Link href={`/stocks/detail?t=${holding.ticker}`} className="font-medium hover:underline">
                              {holding.name}
                            </Link>
                            <span className="ml-1.5 text-xs text-[var(--ink-muted)]">{holding.ticker}</span>
                          </td>
                          <td className="py-2 text-right tabular">{yen(holding.quote?.price)}</td>
                          <td className="py-2 pl-3 text-right">
                            <VerdictBadge verdict={valuation.verdict} />
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
              <div className="mt-3 text-right">
                <Link href="/stocks" className="text-xs text-[var(--series-1)] underline">すべて見る →</Link>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
