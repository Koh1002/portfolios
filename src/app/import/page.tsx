"use client";

import { usePortfolio } from "@/lib/use-portfolio";
import { Card, Loading, PageHeader } from "@/components/ui";
import { ImportClient } from "@/components/import-client";

export default function ImportPage() {
  const { ready, portfolio } = usePortfolio();
  if (!ready) return <Loading />;

  return (
    <div>
      <PageHeader
        title="CSVインポート"
        description="マネーフォワードME・SBI証券・楽天証券のCSVから資産データを取り込みます"
      />
      <div className="mb-5 rounded-lg border border-[#c8dcf5] bg-[#e8f0fb] px-4 py-3 text-sm text-[#1c5cab]">
        <strong>おすすめの運用（マネーフォワードME無料版）</strong>: ① 口座・資産ページに現在の資産を登録して
        「📸 スナップショット記録」で基準日の断面を1回記録 → ② MFの<strong>月ごとの入出金明細CSV</strong>を
        毎月ここで積み上げてインポート（複数月まとめてOK・過去分も遡れます）。
        入出金から資産推移が自動で推計されます。
      </div>
      <div className="mb-5 grid gap-4 lg:grid-cols-3">
        <Card title="マネーフォワードME">
          <ul className="list-disc space-y-1 pl-4 text-xs leading-relaxed text-[var(--ink-secondary)]">
            <li>「家計簿」→ 月を選択 → CSVダウンロード（無料版は月単位の入出金明細のみ）</li>
            <li>毎月積み上げてインポート。同じ月を再取込すると置き換えられ重複しません</li>
            <li>プレミアムの資産推移CSVにも対応（取り込むと実測点になります）</li>
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

      <ImportClient accounts={portfolio.accounts.map((a) => ({ id: a.id, name: a.name }))} />

      <p className="mt-5 text-xs text-[var(--ink-muted)]">
        💡 保有資産CSVを取り込む前に、口座・資産ページで取り込み先口座（例:「SBI証券」）を作成してください。
        文字コード（Shift_JIS / UTF-8）は自動判定されます。ファイルはブラウザ内で処理され、外部送信されません。
      </p>
    </div>
  );
}
