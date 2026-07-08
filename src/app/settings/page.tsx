"use client";

import { useRef, useState, type FormEvent } from "react";
import { usePortfolioData } from "@/lib/use-portfolio";
import { clearAllData, exportJson, importJson, replaceAllData, saveSettings } from "@/lib/store";
import { buildSampleData } from "@/data/sample-data";
import { DEFAULT_DCF_PARAMS } from "@/lib/types";
import { Card, Loading, PageHeader } from "@/components/ui";

export default function SettingsPage() {
  const { data, ready } = usePortfolioData();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [saved, setSaved] = useState(false);

  if (!ready) return <Loading />;

  const p = data.settings.dcfParams;
  const inputCls =
    "rounded-lg border border-[var(--axis)] bg-white px-2.5 py-1.5 text-sm text-right tabular focus:border-[var(--series-1)] focus:outline-none";

  const onSaveDcf = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const numOr = (key: string, fallback: number, scale = 1) => {
      const v = Number(String(f.get(key) ?? "").trim());
      return isFinite(v) && v > -100 ? v / scale : fallback;
    };
    saveSettings({
      dcfParams: {
        discountRate: numOr("discountRate", DEFAULT_DCF_PARAMS.discountRate, 100),
        terminalGrowth: numOr("terminalGrowth", DEFAULT_DCF_PARAMS.terminalGrowth, 100),
        years: Math.max(1, Math.min(15, Math.round(numOr("years", DEFAULT_DCF_PARAMS.years)))),
        growthCap: numOr("growthCap", DEFAULT_DCF_PARAMS.growthCap, 100),
        growthFloor: numOr("growthFloor", DEFAULT_DCF_PARAMS.growthFloor, 100),
      },
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const onExport = () => {
    const blob = new Blob([exportJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `portfolio-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onImportFile = async (file: File) => {
    const text = await file.text();
    const result = importJson(text);
    setMessage({ ok: result.ok, text: result.message });
  };

  return (
    <div>
      <PageHeader title="設定" description="理論株価計算のパラメータとデータ管理" />

      <div className="max-w-2xl space-y-5">
        <Card title="DCFパラメータ">
          <form onSubmit={onSaveDcf} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <label className="text-xs text-[var(--ink-secondary)]">
                割引率（%）— 株式に要求するリターン。一般に7〜10%
                <input name="discountRate" defaultValue={p.discountRate * 100} className={`${inputCls} mt-1 block w-full`} />
              </label>
              <label className="text-xs text-[var(--ink-secondary)]">
                永続成長率（%）— 予測期間後の成長率。0〜2%が保守的
                <input name="terminalGrowth" defaultValue={p.terminalGrowth * 100} className={`${inputCls} mt-1 block w-full`} />
              </label>
              <label className="text-xs text-[var(--ink-secondary)]">
                予測年数（年）
                <input name="years" defaultValue={p.years} className={`${inputCls} mt-1 block w-full`} />
              </label>
              <label className="text-xs text-[var(--ink-secondary)]">
                成長率の上限（%）— 楽観的な予想をキャップ
                <input name="growthCap" defaultValue={p.growthCap * 100} className={`${inputCls} mt-1 block w-full`} />
              </label>
              <label className="text-xs text-[var(--ink-secondary)]">
                成長率の下限（%）
                <input name="growthFloor" defaultValue={p.growthFloor * 100} className={`${inputCls} mt-1 block w-full`} />
              </label>
            </div>
            <div className="flex items-center gap-3">
              <button className="rounded-lg bg-[var(--series-1)] px-4 py-2 text-sm font-medium text-white hover:opacity-90">
                保存
              </button>
              {saved && <span className="text-xs text-[var(--good)]">✓ 保存しました</span>}
            </div>
          </form>
          <p className="mt-4 text-xs leading-relaxed text-[var(--ink-muted)]">
            割引率を上げるほど理論株価は低く（判定が厳しく）なります。
            目標アセットアロケーションは <a href="./rebalance" className="text-[var(--series-1)] underline">リバランス</a> ページで設定できます。
          </p>
        </Card>

        <Card title="データ管理（バックアップ）">
          <p className="mb-3 text-xs leading-relaxed text-[var(--ink-secondary)]">
            資産データは<strong>この端末のブラウザ内（localStorage）にのみ保存</strong>され、サーバーには送信されません。
            機種変更やブラウザのデータ削除に備えて、定期的にエクスポートしてください。
          </p>
          {message && (
            <div
              className={`mb-3 rounded-lg border px-3 py-2 text-sm ${
                message.ok
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-rose-200 bg-rose-50 text-rose-800"
              }`}
            >
              {message.text}
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={onExport}
              className="rounded-lg bg-[var(--series-1)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              📤 JSONエクスポート
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="rounded-lg border border-[var(--axis)] px-4 py-2 text-sm hover:bg-[var(--page)]"
            >
              📥 JSONから復元
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onImportFile(f);
                e.target.value = "";
              }}
            />
            <button
              onClick={() => {
                if (confirm("サンプルデータで上書きします。現在のデータは失われます。よろしいですか？")) {
                  replaceAllData(buildSampleData());
                  setMessage({ ok: true, text: "サンプルデータを読み込みました。" });
                }
              }}
              className="rounded-lg border border-[var(--axis)] px-4 py-2 text-sm hover:bg-[var(--page)]"
            >
              🧪 サンプルデータを読み込む
            </button>
            <button
              onClick={() => {
                if (confirm("すべてのデータを削除します。よろしいですか？（エクスポートしていないデータは復元できません）")) {
                  clearAllData();
                  setMessage({ ok: true, text: "すべてのデータを削除しました。" });
                }
              }}
              className="rounded-lg border border-rose-200 px-4 py-2 text-sm text-[var(--bad)] hover:bg-rose-50"
            >
              🗑 全データ削除
            </button>
          </div>
        </Card>

        <Card title="株価データの更新について">
          <ul className="list-disc space-y-1 pl-4 text-xs leading-relaxed text-[var(--ink-secondary)]">
            <li>株価・財務データは GitHub Actions が平日16:30(JST)に Yahoo Finance から取得し、サイトに反映します</li>
            <li>対象は銘柄提案ユニバース（約60銘柄）+ リポジトリの <code>scripts/extra-tickers.json</code> に追記した銘柄です</li>
            <li>未登録の銘柄はサンプル値で表示されます。保有銘柄がユニバース外の場合は extra-tickers.json に証券コードを追加してください</li>
            <li>GitHubリポジトリの Actions タブ →「Update market data」→ Run workflow で手動更新もできます</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
