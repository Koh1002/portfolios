import { getPortfolio } from "@/lib/portfolio";
import { PageHeader } from "@/components/ui";
import { SimulationClient } from "@/components/simulation-client";

export const dynamic = "force-dynamic";

export default async function SimulationPage() {
  const portfolio = await getPortfolio();

  return (
    <div>
      <PageHeader
        title="資産シミュレーション"
        description="毎月の積立と複利運用による将来資産の予測、FIRE（早期リタイア）達成時期の試算"
      />
      <SimulationClient initialAssets={portfolio.total} />
      <p className="mt-4 text-xs text-[var(--ink-muted)]">
        シミュレーションは一定利回りでの複利計算による概算であり、実際の運用成果は市場変動により大きく変わります。
        FIREの4%ルールは「年間支出の25倍の資産があれば、年4%の取り崩しで資産が長期間持続する」という米国の経験則です。
      </p>
    </div>
  );
}
