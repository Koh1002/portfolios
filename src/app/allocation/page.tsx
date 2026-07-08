import { getPortfolio } from "@/lib/portfolio";
import { findUniverseStock } from "@/data/stock-universe";
import { ASSET_CLASS_LABEL, NISA_LABEL, type AssetClass, type NisaType } from "@/lib/types";
import { yen, pct } from "@/lib/format";
import { Card, EmptyState, MarketSourceNotice, PageHeader } from "@/components/ui";
import { BreakdownPie } from "@/components/charts";

export const dynamic = "force-dynamic";

export default async function AllocationPage() {
  const portfolio = await getPortfolio();

  const classData = Object.entries(portfolio.byClass)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => ({ key: k, name: ASSET_CLASS_LABEL[k as AssetClass], value: Math.round(v) }));

  // セクター別（株式のみ、ユニバース情報から推定）
  const sectorMap = new Map<string, number>();
  for (const h of portfolio.stockHoldings) {
    const sector = (h.ticker && findUniverseStock(h.ticker)?.sector) || "その他";
    sectorMap.set(sector, (sectorMap.get(sector) ?? 0) + h.value);
  }
  const sectorData = Array.from(sectorMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value: Math.round(value) }));

  // NISA区分別
  const nisaMap = new Map<string, number>();
  for (const h of portfolio.holdings) {
    const label = NISA_LABEL[h.nisa as NisaType] ?? h.nisa;
    nisaMap.set(label, (nisaMap.get(label) ?? 0) + h.value);
  }
  const nisaData = Array.from(nisaMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value: Math.round(value) }));

  // 集中リスク警告
  const warnings: string[] = [];
  const stockTotal = portfolio.stockHoldings.reduce((s, h) => s + h.value, 0);
  for (const h of portfolio.stockHoldings) {
    if (stockTotal > 0 && h.value / stockTotal > 0.25) {
      warnings.push(
        `「${h.name}」が株式全体の${((h.value / stockTotal) * 100).toFixed(0)}%を占めています（1銘柄25%超）。個別銘柄リスクに注意してください。`,
      );
    }
  }
  for (const [sector, value] of sectorMap) {
    if (sector !== "その他" && stockTotal > 0 && value / stockTotal > 0.4) {
      warnings.push(
        `${sector}セクターが株式全体の${((value / stockTotal) * 100).toFixed(0)}%を占めています（1セクター40%超）。セクター分散を検討してください。`,
      );
    }
  }
  for (const [k, v] of Object.entries(portfolio.byClass)) {
    if (portfolio.total > 0 && v / portfolio.total > 0.7 && k !== "cash") {
      warnings.push(
        `${ASSET_CLASS_LABEL[k as AssetClass]}が総資産の${((v / portfolio.total) * 100).toFixed(0)}%を占めています。資産クラスの分散を検討してください。`,
      );
    }
  }

  return (
    <div>
      <PageHeader
        title="アロケーション分析"
        description="資産クラス・セクター・口座区分ごとの分散状況と集中リスクのチェック"
      />
      <MarketSourceNotice sources={portfolio.marketSources} />

      {portfolio.total <= 0 ? (
        <EmptyState title="資産が登録されていません" />
      ) : (
        <>
          {warnings.length > 0 ? (
            <Card title="⚠️ 集中リスク警告" className="mb-4 border-amber-300">
              <ul className="space-y-1.5 text-sm text-amber-800">
                {warnings.map((w, i) => (
                  <li key={i}>・{w}</li>
                ))}
              </ul>
            </Card>
          ) : (
            <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              ✅ 大きな集中リスクは検出されませんでした（1銘柄25%超・1セクター40%超・1資産クラス70%超をチェック）。
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-3">
            <Card title="資産クラス別">
              <BreakdownPie data={classData} height={220} />
            </Card>
            <Card title="セクター別（株式のみ）">
              {sectorData.length > 0 ? (
                <BreakdownPie data={sectorData} height={220} />
              ) : (
                <p className="py-10 text-center text-sm text-[var(--ink-muted)]">株式の保有がありません</p>
              )}
            </Card>
            <Card title="口座区分別（NISA/課税）">
              <BreakdownPie data={nisaData} height={220} />
            </Card>
          </div>

          <Card title="株式の銘柄別ウェイト" className="mt-4">
            {portfolio.stockHoldings.length === 0 ? (
              <p className="py-6 text-center text-sm text-[var(--ink-muted)]">株式の保有がありません</p>
            ) : (
              <div className="space-y-2">
                {[...portfolio.stockHoldings]
                  .sort((a, b) => b.value - a.value)
                  .map((h) => {
                    const w = stockTotal > 0 ? (h.value / stockTotal) * 100 : 0;
                    return (
                      <div key={h.id} className="flex items-center gap-3 text-sm">
                        <span className="w-52 shrink-0 truncate">
                          {h.name}
                          <span className="ml-1 text-xs text-[var(--ink-muted)]">{h.ticker}</span>
                        </span>
                        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--grid)]">
                          <div
                            className={`h-full rounded-full ${w > 25 ? "bg-[var(--series-8)]" : "bg-[var(--series-1)]"}`}
                            style={{ width: `${Math.min(100, w)}%` }}
                          />
                        </div>
                        <span className="w-14 text-right tabular text-xs">{pct(w, 1)}</span>
                        <span className="w-28 text-right tabular text-xs text-[var(--ink-secondary)]">{yen(h.value)}</span>
                      </div>
                    );
                  })}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
