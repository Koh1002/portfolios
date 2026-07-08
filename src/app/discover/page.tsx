import Link from "next/link";
import { SECTORS, STOCK_UNIVERSE, type Sector } from "@/data/stock-universe";
import { getFundamentals, getQuote } from "@/lib/yahoo";
import { computeValuation } from "@/lib/valuation";
import { scoreStock } from "@/lib/scoring";
import { getDcfParams } from "@/lib/settings";
import { getPortfolio } from "@/lib/portfolio";
import { yen, pct } from "@/lib/format";
import { Card, EmptyState, MarketSourceNotice, PageHeader, ScoreBar, Stars, VerdictBadge } from "@/components/ui";
import type { MarketSource } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ sector?: string }>;
}) {
  const { sector } = await searchParams;
  const activeSector = SECTORS.includes(sector as Sector) ? (sector as Sector) : null;

  const portfolio = await getPortfolio();
  const heldTickers = new Set(portfolio.stockHoldings.map((h) => h.ticker));
  const dcfParams = getDcfParams();

  const universe = STOCK_UNIVERSE.filter((s) => !heldTickers.has(s.code)).filter(
    (s) => !activeSector || s.sector === activeSector,
  );

  const sources = new Set<MarketSource>();
  const scored = (
    await Promise.all(
      universe.map(async (stock) => {
        const [quoteRes, fundRes] = await Promise.all([
          getQuote(stock.code, stock.name),
          getFundamentals(stock.code, stock.name),
        ]);
        if (!quoteRes.data || !fundRes.data) return null;
        sources.add(quoteRes.source);
        const valuation = computeValuation(quoteRes.data, fundRes.data, dcfParams);
        const score = scoreStock(stock, quoteRes.data, fundRes.data, valuation);
        return { stock, quote: quoteRes.data, valuation, score };
      }),
    )
  ).filter((x): x is NonNullable<typeof x> => x != null);

  scored.sort((a, b) => b.score.total - a.score.total);

  const tabCls = (active: boolean) =>
    `rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
      active
        ? "border-[var(--series-1)] bg-[#e8f0fb] font-semibold text-[#1c5cab]"
        : "border-[var(--axis)] text-[var(--ink-secondary)] hover:bg-[var(--surface)]"
    }`;

  return (
    <div>
      <PageHeader
        title="銘柄をさがす"
        description="未保有の注目銘柄を「株価分析 × 配当 × 株主優待」の3観点でスコアリングして提案します（保有中の銘柄は除外）"
      />
      <MarketSourceNotice sources={Array.from(sources)} />

      <div className="mb-5 flex flex-wrap gap-2">
        <Link href="/discover" className={tabCls(activeSector == null)}>
          総合ランキング
        </Link>
        {SECTORS.map((s) => (
          <Link key={s} href={`/discover?sector=${encodeURIComponent(s)}`} className={tabCls(activeSector === s)}>
            {s}
          </Link>
        ))}
      </div>

      {scored.length === 0 ? (
        <EmptyState title="表示できる銘柄がありません" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {scored.map(({ stock, quote, valuation, score }, rank) => (
            <Card key={stock.code}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[var(--ink-muted)]">#{rank + 1}</span>
                    <Link href={`/stocks/${stock.code}`} className="text-base font-bold hover:underline">
                      {stock.name}
                    </Link>
                    <span className="text-xs text-[var(--ink-muted)]">{stock.code}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-[var(--ink-secondary)]">
                    {stock.sector}
                    {stock.note && ` ・ ${stock.note}`}
                  </div>
                </div>
                <div className="text-right">
                  <Stars value={score.stars} />
                  <div className="mt-0.5 text-xs text-[var(--ink-muted)]">総合 {score.total.toFixed(1)} / 5</div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
                <span className="tabular font-medium">{yen(quote.price)}</span>
                <VerdictBadge verdict={valuation.verdict} />
                {valuation.upsidePct != null && (
                  <span className={`text-xs tabular ${valuation.upsidePct >= 0 ? "text-[var(--good)]" : "text-[var(--bad)]"}`}>
                    理論株価まで {pct(valuation.upsidePct, 1, { signed: true })}
                  </span>
                )}
                {quote.dividendYieldPct != null && quote.dividendYieldPct > 0 && (
                  <span className="text-xs text-[var(--ink-secondary)]">利回り {pct(quote.dividendYieldPct, 2)}</span>
                )}
              </div>

              <div className="mt-3 space-y-1.5">
                <ScoreBar label="株価分析" score={score.valuationScore} />
                <ScoreBar label="配当" score={score.dividendScore} />
                <ScoreBar label="株主優待" score={score.yutaiScore} />
              </div>

              <ul className="mt-3 space-y-1 border-t border-[var(--grid)] pt-3 text-xs leading-relaxed text-[var(--ink-secondary)]">
                {score.reasons.map((r, i) => (
                  <li key={i}>・{r}</li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}

      <p className="mt-5 text-xs leading-relaxed text-[var(--ink-muted)]">
        対象は6セクター×約10銘柄のキュレートリスト（src/data/stock-universe.ts で編集可能）。
        スコアは 株価分析45% + 配当35% + 株主優待20% の加重平均。株主優待の内容・権利確定月は目安です（最新は各社IRをご確認ください）。
        本提案は情報提供であり、投資勧誘ではありません。
      </p>
    </div>
  );
}
