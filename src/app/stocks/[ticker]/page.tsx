import Link from "next/link";
import { getFundamentals, getQuote } from "@/lib/yahoo";
import { computeValuation } from "@/lib/valuation";
import { getDcfParams } from "@/lib/settings";
import { yen, yenCompact, pct, num } from "@/lib/format";
import { Card, PageHeader, SourceBadge, StatCard, VerdictBadge } from "@/components/ui";
import { AnnualChart, QuarterlyChart } from "@/components/charts";
import { findUniverseStock } from "@/data/stock-universe";

export const dynamic = "force-dynamic";

export default async function StockDetailPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  const uni = findUniverseStock(ticker);
  const [quoteRes, fundRes] = await Promise.all([
    getQuote(ticker, uni?.name),
    getFundamentals(ticker, uni?.name),
  ]);
  const quote = quoteRes.data;
  const fund = fundRes.data;
  const dcfParams = getDcfParams();
  const valuation = quote && fund ? computeValuation(quote, fund, dcfParams) : null;

  if (!quote) {
    return (
      <div>
        <PageHeader title={`${ticker} の分析`} />
        <p className="text-sm text-[var(--ink-secondary)]">株価データを取得できませんでした。</p>
      </div>
    );
  }

  const quarterly = (fund?.quarterlyResults ?? []).filter((q) => q.revenue != null || q.earnings != null);
  const annual = (fund?.annualResults ?? []).map((a) => ({
    label: `${a.year}年`,
    revenue: a.revenue,
    netIncome: a.netIncome,
  }));

  return (
    <div>
      <PageHeader
        title={`${quote.name}（${ticker}）`}
        description={uni ? `${uni.sector} / ${uni.note ?? ""}` : undefined}
        action={
          <div className="flex items-center gap-2">
            <SourceBadge source={quoteRes.source} />
            <Link href="/stocks" className="text-sm text-[var(--series-1)] hover:underline">← 一覧へ戻る</Link>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="現在値"
          value={yen(quote.price)}
          sub={quote.changePercent != null ? `前日比 ${pct(quote.changePercent, 2, { signed: true })}` : undefined}
          tone={quote.changePercent != null && quote.changePercent < 0 ? "bad" : "good"}
        />
        <StatCard
          label="理論株価（3手法加重平均）"
          value={valuation?.fairValue != null ? yen(valuation.fairValue) : "−"}
          sub={
            valuation?.upsidePct != null
              ? `上昇余地 ${pct(valuation.upsidePct, 1, { signed: true })}`
              : "計算に必要なデータが不足"
          }
        />
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
          <div className="text-xs font-medium text-[var(--ink-muted)]">判定</div>
          <div className="mt-2">
            <VerdictBadge verdict={valuation?.verdict ?? null} />
          </div>
          <div className="mt-1.5 text-xs text-[var(--ink-secondary)]">
            {valuation?.ratio != null && `現在値は理論株価の${(valuation.ratio * 100).toFixed(0)}%`}
          </div>
        </div>
        <StatCard
          label="配当利回り / 配当性向"
          value={quote.dividendYieldPct != null ? pct(quote.dividendYieldPct, 2) : "無配"}
          sub={
            (quote.dividendRate != null ? `1株配当 ${yen(quote.dividendRate)}` : "") +
            (fund?.payoutRatio != null ? ` / 配当性向 ${pct(fund.payoutRatio * 100, 0)}` : "")
          }
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="時価総額" value={yenCompact(quote.marketCap)} />
        <StatCard label="PER（実績/予想）" value={`${num(quote.trailingPE, 1)} / ${num(quote.forwardPE, 1)}倍`} />
        <StatCard label="PBR" value={`${num(quote.priceToBook, 2)}倍`} />
        <StatCard
          label="52週レンジ"
          value={`${num(quote.fiftyTwoWeekLow)} 〜 ${num(quote.fiftyTwoWeekHigh)}`}
          sub={fund?.nextEarningsDate ? `次回決算: ${fund.nextEarningsDate}` : undefined}
        />
      </div>

      {/* 業績チャート */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title={`四半期業績（売上高・純利益）${fundRes.source === "mock" ? "※サンプル" : ""}`}>
          {quarterly.length > 0 ? (
            <QuarterlyChart data={quarterly} />
          ) : (
            <p className="py-10 text-center text-sm text-[var(--ink-muted)]">四半期業績データを取得できませんでした</p>
          )}
        </Card>
        <Card title={`通期業績の推移${fundRes.source === "mock" ? "※サンプル" : ""}`}>
          {annual.length > 0 ? (
            <AnnualChart data={annual} />
          ) : (
            <p className="py-10 text-center text-sm text-[var(--ink-muted)]">通期業績データを取得できませんでした</p>
          )}
        </Card>
      </div>

      {/* 理論株価の計算過程 */}
      <Card title="理論株価の計算過程" className="mt-4">
        {!valuation ? (
          <p className="text-sm text-[var(--ink-muted)]">財務データ不足のため計算できません。</p>
        ) : (
          <div className="grid gap-5 lg:grid-cols-3">
            {/* DCF */}
            <div className="rounded-lg bg-[var(--page)] p-4">
              <h3 className="text-sm font-semibold">
                ① DCF法{valuation.dcf && <span className="ml-2 text-xs font-normal text-[var(--ink-muted)]">重み {(valuation.weights.dcf * 100).toFixed(0)}%</span>}
              </h3>
              {valuation.dcf ? (
                <div className="mt-2 space-y-1 text-xs text-[var(--ink-secondary)]">
                  <p>ベースFCF: <span className="tabular">{yenCompact(valuation.dcf.baseFcf)}</span>（直近実績と過去平均の保守値）</p>
                  <p>
                    成長率: <span className="tabular">{pct(valuation.dcf.usedGrowth * 100, 1)}</span>
                    （{valuation.dcf.growthSource}・上限{pct(dcfParams.growthCap * 100, 0)}でキャップ）
                  </p>
                  <p>割引率: {pct(dcfParams.discountRate * 100, 1)} / 永続成長率: {pct(dcfParams.terminalGrowth * 100, 1)}</p>
                  <table className="mt-2 w-full">
                    <thead>
                      <tr className="border-b border-[var(--grid)] text-left text-[var(--ink-muted)]">
                        <th className="py-1 font-medium">年</th>
                        <th className="py-1 text-right font-medium">予測FCF</th>
                        <th className="py-1 text-right font-medium">現在価値</th>
                      </tr>
                    </thead>
                    <tbody>
                      {valuation.dcf.projection.map((p) => (
                        <tr key={p.year}>
                          <td className="py-0.5">{p.year}年目</td>
                          <td className="py-0.5 text-right tabular">{yenCompact(p.fcf)}</td>
                          <td className="py-0.5 text-right tabular">{yenCompact(p.pv)}</td>
                        </tr>
                      ))}
                      <tr className="border-t border-[var(--grid)]">
                        <td className="py-0.5">残存価値</td>
                        <td className="py-0.5 text-right tabular">{yenCompact(valuation.dcf.terminalValue)}</td>
                        <td className="py-0.5 text-right tabular">{yenCompact(valuation.dcf.terminalPv)}</td>
                      </tr>
                    </tbody>
                  </table>
                  <p className="pt-1">
                    事業価値 {yenCompact(valuation.dcf.enterpriseValue)} − 純有利子負債 {yenCompact(valuation.dcf.netDebt)} ={" "}
                    株主価値 {yenCompact(valuation.dcf.equityValue)}
                  </p>
                  <p className="text-sm font-bold text-[var(--ink)]">→ 1株あたり {yen(valuation.dcf.fairValue)}</p>
                </div>
              ) : (
                <p className="mt-2 text-xs text-[var(--ink-muted)]">FCFが赤字またはデータ不足のため計算対象外</p>
              )}
            </div>

            {/* PER */}
            <div className="rounded-lg bg-[var(--page)] p-4">
              <h3 className="text-sm font-semibold">
                ② PER法{valuation.per && <span className="ml-2 text-xs font-normal text-[var(--ink-muted)]">重み {(valuation.weights.per * 100).toFixed(0)}%</span>}
              </h3>
              {valuation.per ? (
                <div className="mt-2 space-y-1 text-xs text-[var(--ink-secondary)]">
                  <p>{valuation.per.epsSource}: <span className="tabular">{yen(valuation.per.usedEps)}</span></p>
                  <p>妥当PER: <span className="tabular">{num(valuation.per.usedPer, 1)}倍</span>（実績・予想PERの平均を8〜25倍でキャップ）</p>
                  <p className="text-sm font-bold text-[var(--ink)]">→ 1株あたり {yen(valuation.per.fairValue)}</p>
                </div>
              ) : (
                <p className="mt-2 text-xs text-[var(--ink-muted)]">EPSが赤字またはデータ不足のため計算対象外</p>
              )}
            </div>

            {/* DDM */}
            <div className="rounded-lg bg-[var(--page)] p-4">
              <h3 className="text-sm font-semibold">
                ③ 配当割引モデル{valuation.ddm && <span className="ml-2 text-xs font-normal text-[var(--ink-muted)]">重み {(valuation.weights.ddm * 100).toFixed(0)}%</span>}
              </h3>
              {valuation.ddm ? (
                <div className="mt-2 space-y-1 text-xs text-[var(--ink-secondary)]">
                  <p>1株配当: <span className="tabular">{yen(valuation.ddm.dividend)}</span></p>
                  <p>配当成長率: {pct(valuation.ddm.usedGrowth * 100, 1)}（上限3%）</p>
                  <p>計算式: D×(1+g) ÷ (割引率 − g)</p>
                  <p className="text-sm font-bold text-[var(--ink)]">→ 1株あたり {yen(valuation.ddm.fairValue)}</p>
                </div>
              ) : (
                <p className="mt-2 text-xs text-[var(--ink-muted)]">無配・配当性向90%超・またはデータ不足のため計算対象外</p>
              )}
            </div>
          </div>
        )}
        <p className="mt-4 text-xs text-[var(--ink-muted)]">
          割引率などのパラメータは <Link href="/settings" className="text-[var(--series-1)] underline">設定</Link> で変更できます。
          理論株価は前提に依存する参考値であり、投資成果を保証するものではありません。
        </p>
      </Card>
    </div>
  );
}
