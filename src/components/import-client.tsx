"use client";

// CSVインポート（すべてブラウザ内で処理。ファイルは外部送信されない）

import { useState } from "react";
import { parseCsv, type ParsedCsv } from "@/lib/csv/parse";
import {
  addHoldings,
  loadData,
  replaceTransactionsInRange,
  upsertSnapshots,
} from "@/lib/store";
import { loadMarketBundle, quoteFromBundle } from "@/lib/market-client";
import { computePortfolio } from "@/lib/compute-portfolio";
import { today } from "@/lib/format";

const KIND_LABEL: Record<string, string> = {
  snapshots: "資産推移スナップショット（マネーフォワードME 資産推移CSV）",
  transactions: "収支明細（マネーフォワードME 家計簿CSV）",
  holdings: "保有資産（保有株式・投信などの一覧CSV）",
  unknown: "不明な形式",
};

type Preview = {
  parsed: ParsedCsv;
  sample: Record<string, string | number | null>[];
};

function buildPreview(parsed: ParsedCsv): Preview {
  switch (parsed.kind) {
    case "snapshots":
      return {
        parsed,
        sample: parsed.rows.slice(0, 8).map((r) => ({ 日付: r.date, カテゴリ: r.category, 金額: r.amount })),
      };
    case "transactions":
      return {
        parsed,
        sample: parsed.rows.slice(0, 8).map((r) => ({
          日付: r.date,
          内容: r.description,
          金額: r.amount,
          大項目: r.category,
          金融機関: r.institution,
        })),
      };
    case "holdings":
      return {
        parsed,
        sample: parsed.rows.slice(0, 8).map((r) => ({
          種別: r.assetType,
          コード: r.ticker,
          銘柄: r.name,
          数量: r.quantity,
          取得単価: r.avgCost,
          評価額: r.currentValue,
          口座区分: r.nisa,
        })),
      };
    default:
      return { parsed, sample: [] };
  }
}

export function ImportClient({ accounts }: { accounts: { id: number; name: string }[] }) {
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [accountId, setAccountId] = useState<number | undefined>(accounts[0]?.id);
  const [mode, setMode] = useState<"replace" | "append">("replace");

  async function onFile(file: File) {
    setResult(null);
    setFileName(file.name);
    const buf = new Uint8Array(await file.arrayBuffer());
    setPreview(buildPreview(parseCsv(buf)));
  }

  async function onCommit() {
    if (!preview) return;
    const { parsed } = preview;

    if (parsed.kind === "snapshots") {
      upsertSnapshots(parsed.rows.map((r) => ({ ...r })), "import");
      setResult({ ok: true, message: `資産推移スナップショット ${parsed.rows.length}件を取り込みました。` });
    } else if (parsed.kind === "transactions") {
      if (parsed.rows.length === 0) {
        setResult({ ok: false, message: "取り込める明細がありませんでした。" });
        return;
      }
      const dates = parsed.rows.map((r) => r.date).sort();
      replaceTransactionsInRange(parsed.rows);
      setResult({
        ok: true,
        message: `収支明細 ${parsed.rows.length}件を取り込みました（${dates[0]}〜${dates[dates.length - 1]}の既存明細は置き換え）。`,
      });
    } else if (parsed.kind === "holdings") {
      if (!accountId) {
        setResult({ ok: false, message: "取り込み先の口座を選択してください。" });
        return;
      }
      addHoldings(
        parsed.rows.map((r) => ({
          accountId,
          assetType: r.assetType,
          ticker: r.ticker,
          name: r.name,
          quantity: r.quantity,
          avgCost: r.avgCost,
          manualValue: r.currentValue,
          nisa: r.nisa,
        })),
        mode === "replace" ? { replaceAccountId: accountId } : undefined,
      );
      // 取り込み後の最新データでスナップショットを記録
      const bundle = await loadMarketBundle();
      const fresh = computePortfolio(loadData(), (t, n) => quoteFromBundle(bundle, t, n));
      const date = today();
      upsertSnapshots(
        Object.entries(fresh.byClass)
          .filter(([, v]) => v != null && v !== 0)
          .map(([category, amount]) => ({ date, category, amount: amount! })),
        "auto",
      );
      setResult({
        ok: true,
        message: `保有資産 ${parsed.rows.length}件を取り込みました（${mode === "replace" ? "洗い替え" : "追加"}）。`,
      });
    } else {
      setResult({ ok: false, message: "CSVの形式を判定できませんでした。対応形式か確認してください。" });
      return;
    }
    setPreview(null);
  }

  const inputCls =
    "rounded-lg border border-[var(--axis)] bg-white px-2.5 py-1.5 text-sm focus:border-[var(--series-1)] focus:outline-none";

  return (
    <div className="space-y-4">
      <label className="block cursor-pointer rounded-xl border-2 border-dashed border-[var(--axis)] bg-[var(--surface)] p-10 text-center transition-colors hover:border-[var(--series-1)]">
        <input
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
            e.target.value = "";
          }}
        />
        <div className="text-3xl">📄</div>
        <div className="mt-2 font-medium">CSVファイルを選択</div>
        <div className="mt-1 text-xs text-[var(--ink-muted)]">
          マネーフォワードME（資産推移・家計簿・保有資産）／ SBI証券・楽天証券の保有商品CSV に対応（Shift_JIS自動判定）。
          ファイルはブラウザ内で処理され、外部には送信されません。
        </div>
        {fileName && <div className="mt-2 text-sm text-[var(--series-1)]">{fileName}</div>}
      </label>

      {result && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            result.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          {result.message}
        </div>
      )}

      {preview && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
          <h2 className="text-sm font-semibold">
            判定された形式: <span className="text-[var(--series-1)]">{KIND_LABEL[preview.parsed.kind]}</span>
            {preview.parsed.kind !== "unknown" && (
              <span className="ml-2 text-xs font-normal text-[var(--ink-muted)]">{preview.parsed.rows.length}件</span>
            )}
          </h2>

          {preview.parsed.kind === "unknown" ? (
            <div className="mt-3 text-sm text-[var(--ink-secondary)]">
              <p>このCSVの形式を判定できませんでした。検出されたヘッダー:</p>
              <code className="mt-1 block rounded bg-[var(--page)] p-2 text-xs">
                {preview.parsed.headers?.join(", ")}
              </code>
            </div>
          ) : (
            <>
              {preview.sample.length > 0 && (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-[var(--grid)] text-left text-[var(--ink-muted)]">
                        {Object.keys(preview.sample[0]).map((k) => (
                          <th key={k} className="py-1.5 pr-4 font-medium">{k}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.sample.map((row, i) => (
                        <tr key={i} className="border-b border-[var(--grid)] last:border-0">
                          {Object.values(row).map((v, j) => (
                            <td key={j} className="py-1.5 pr-4 tabular">
                              {typeof v === "number" ? v.toLocaleString("ja-JP") : (v ?? "−")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-[var(--grid)] pt-4">
                {preview.parsed.kind === "holdings" && (
                  <>
                    <label className="text-xs text-[var(--ink-secondary)]">
                      取り込み先の口座
                      <select
                        className={`${inputCls} mt-1 block w-44`}
                        value={accountId}
                        onChange={(e) => setAccountId(Number(e.target.value))}
                      >
                        {accounts.length === 0 && <option value="">（口座がありません）</option>}
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs text-[var(--ink-secondary)]">
                      取り込み方法
                      <select
                        className={`${inputCls} mt-1 block w-52`}
                        value={mode}
                        onChange={(e) => setMode(e.target.value as "replace" | "append")}
                      >
                        <option value="replace">洗い替え（口座の既存保有を置き換え）</option>
                        <option value="append">追加（既存保有に追記）</option>
                      </select>
                    </label>
                  </>
                )}
                <button
                  onClick={onCommit}
                  disabled={preview.parsed.kind === "holdings" && !accountId}
                  className="rounded-lg bg-[var(--series-1)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  この内容で取り込む
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
