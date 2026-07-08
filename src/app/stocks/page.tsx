"use client";

import Link from "next/link";
import { usePortfolio } from "@/lib/use-portfolio";
import { computeValuation } from "@/lib/valuation";
import { yen, pct } from "@/lib/format";
import { Card, EmptyState, GainText, Loading, MarketSourceNotice, PageHeader, VerdictBadge } from "@/components/ui";

export default function StocksPage() {
  const { ready, portfolio, data, marketDateLabel, getFundamentals } = usePortfolio();
  if (!ready) return <Loading />;

  const rows = portfolio.stockHoldings
    .map((h) => {
      const fund = h.ticker ? getFundamentals(h.ticker, h.name) : null;
      const valuation = h.quote && fund?.data ? computeValuation(h.quote, fund.data, data.settings.dcfParams) : null;
      return { holding: h, valuation };
    })
    .sort((a, b) => (a.valuation?.ratio ?? 99) - (b.valuation?.ratio ?? 99));

  return (
    <div>
      <PageHeader
        title="保有株分析"
        description="DCF法・PER法・配当割引モデルの3手法による理論株価と割安/割高判定"
      />
      <MarketSourceNotice sources={portfolio.marketSources} dateLabel={marketDateLabel} />

      {rows.length === 0 ? (
        <EmptyState title="ティッカー付きの保有株がありません">
          <Link href="/accounts" className="text-[var(--series-1)] underline">口座・資産</Link> で証券コード付きの株式を登録するか、CSVをインポートしてください
        </EmptyState>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--grid)] text-left text-xs text-[var(--ink-muted)]">
                  <th className="py-2 font-medium">銘柄</th>
                  <th className="py-2 text-right font-medium">現在値</th>
                  <th className="py-2 text-right font-medium">理論株価</th>
                  <th className="py-2 text-right font-medium">上昇余地</th>
                  <th className="py-2 pl-4 font-medium">判定</th>
                  <th className="py-2 text-right font-medium">保有数</th>
                  <th className="py-2 text-right font-medium">評価額</th>
                  <th className="py-2 text-right font-medium">評価損益</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map(({ holding: h, valuation }) => (
                  <tr key={h.id} className="border-b border-[var(--grid)] last:border-0 hover:bg-[var(--page)]">
                    <td className="py-2.5">
                      <Link href={`/stocks/detail?t=${h.ticker}`} className="font-medium hover:underline">
                        {h.name}
                      </Link>
                      <span className="ml-1.5 text-xs text-[var(--ink-muted)]">{h.ticker}</span>
                    </td>
                    <td className="py-2.5 text-right tabular">{yen(h.quote?.price)}</td>
                    <td className="py-2.5 text-right tabular font-medium">
                      {valuation?.fairValue != null ? yen(valuation.fairValue) : "−"}
                    </td>
                    <td className="py-2.5 text-right tabular">
                      {valuation?.upsidePct != null ? (
                        <span className={valuation.upsidePct >= 0 ? "text-[var(--good)]" : "text-[var(--bad)]"}>
                          {pct(valuation.upsidePct, 1, { signed: true })}
                        </span>
                      ) : (
                        "−"
                      )}
                    </td>
                    <td className="py-2.5 pl-4">
                      <VerdictBadge verdict={valuation?.verdict ?? null} />
                    </td>
                    <td className="py-2.5 text-right tabular">{h.quantity.toLocaleString("ja-JP")}</td>
                    <td className="py-2.5 text-right tabular">{yen(h.value)}</td>
                    <td className="py-2.5 text-right">
                      <GainText value={h.gain} pct={h.gainPct} />
                    </td>
                    <td className="py-2.5 pl-3 text-right">
                      <Link href={`/stocks/detail?t=${h.ticker}`} className="text-xs text-[var(--series-1)] hover:underline">
                        詳細 →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <p className="mt-4 text-xs leading-relaxed text-[var(--ink-muted)]">
        理論株価は DCF法（50%）・PER法（30%）・配当割引モデル（20%）の加重平均（計算できない手法は重みを再配分）。
        現在値が理論株価の ±10% 以内なら「適正」、-10%〜-25%で「やや割安」、それ以下で「割安」（割高側も同様）。
        投資判断はご自身の責任で行ってください。
      </p>
    </div>
  );
}
