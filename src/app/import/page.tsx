import { asc } from "drizzle-orm";
import { db, accounts } from "@/db";
import { Card, PageHeader } from "@/components/ui";
import { ImportClient } from "@/components/import-client";

export const dynamic = "force-dynamic";

export default function ImportPage() {
  const accountRows = db.select().from(accounts).orderBy(asc(accounts.id)).all();

  return (
    <div>
      <PageHeader
        title="CSVインポート"
        description="マネーフォワードME・SBI証券・楽天証券のCSVから資産データを取り込みます"
      />
      <div className="mb-5 grid gap-4 lg:grid-cols-3">
        <Card title="マネーフォワードME">
          <ul className="list-disc space-y-1 pl-4 text-xs leading-relaxed text-[var(--ink-secondary)]">
            <li>「資産推移」ページ → CSVダウンロード → 資産推移グラフに反映</li>
            <li>「家計簿（収入・支出詳細）」→ CSVダウンロード → 収支ページに反映</li>
            <li>資産の保有明細CSV → 保有資産として取り込み</li>
          </ul>
        </Card>
        <Card title="SBI証券">
          <ul className="list-disc space-y-1 pl-4 text-xs leading-relaxed text-[var(--ink-secondary)]">
            <li>「口座管理」→「保有証券」→ CSVダウンロード</li>
            <li>株式・投信のセクション見出しとNISA預り区分を自動判別します</li>
          </ul>
        </Card>
        <Card title="楽天証券">
          <ul className="list-disc space-y-1 pl-4 text-xs leading-relaxed text-[var(--ink-secondary)]">
            <li>「マイメニュー」→「保有商品一覧」→ CSV保存</li>
            <li>つみたてNISA/成長投資枠の口座区分を自動判別します</li>
          </ul>
        </Card>
      </div>

      <ImportClient accounts={accountRows.map((a) => ({ id: a.id, name: a.name }))} />

      <p className="mt-5 text-xs text-[var(--ink-muted)]">
        💡 保有資産CSVを取り込む前に、口座・資産ページで取り込み先口座（例:「SBI証券」）を作成してください。
        文字コード（Shift_JIS / UTF-8）は自動判定されます。
      </p>
    </div>
  );
}
