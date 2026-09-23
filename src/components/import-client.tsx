"use client";

// CSVインポート（すべてブラウザ内で処理。ファイルは外部送信されない）
// マネーフォワードMEの月次入出金CSVを毎月「積み上げて」取り込む運用を想定し、
// 複数ファイルの一括インポートに対応。取込済み期間は洗い替えされるので重複しない。

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
import { transactionCoverage } from "@/lib/derive-series";
import { today } from "@/lib/format";

const KIND_LABEL: Record<string, string> = {
  snapshots: "資産推移スナップショット（MF資産推移CSV）",
  transactions: "入出金明細（MF家計簿CSV）",
  holdings: "保有資産（保有株式・投信などの一覧CSV）",
  unknown: "不明な形式",
};

type FileEntry = {
  name: string;
  parsed: ParsedCsv;
  sample: Record<string, string | number | null>[];
};

function buildSample(parsed: ParsedCsv): FileEntry["sample"] {
  switch (parsed.kind) {
    case "snapshots":
      return parsed.rows.slice(0, 8).map((r) => ({ 日付: r.date, カテゴリ: r.category, 金額: r.amount }));
    case "transactions":
      return parsed.rows.slice(0, 8).map((r) => ({
        日付: r.date,
        内容: r.description,
        金額: r.amount,
        大項目: r.category,
        金融機関: r.institution,
      }));
    case "holdings":
      return parsed.rows.slice(0, 8).map((r) => ({
        種別: r.assetType,
        コード: r.ticker,
        銘柄: r.name,
        数量: r.quantity,
        取得単価: r.avgCost,
        評価額: r.currentValue,
        口座区分: r.nisa,
      }));
    default:
      return [];
  }
}

export function ImportClient({ accounts }: { accounts: { id: number; name: string }[] }) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [result, setResult] = useState<{ ok: boolean; messages: string[] } | null>(null);
  const [accountId, setAccountId] = useState<number | undefined>(accounts[0]?.id);
  const [mode, setMode] = useState<"replace" | "append">("replace");

  async function onSelectFiles(fileList: FileList) {
    setResult(null);
    const entries: FileEntry[] = [];
    for (const file of Array.from(fileList)) {
      const buf = new Uint8Array(await file.arrayBuffer());
      const parsed = parseCsv(buf);
      entries.push({ name: file.name, parsed, sample: buildSample(parsed) });
    }
    // 入出金明細は日付順に取り込まれるようファイルを期間順に並べる
    entries.sort((a, b) => {
      const first = (e: FileEntry) =>
        e.parsed.kind === "transactions" && e.parsed.rows.length > 0 ? e.parsed.rows[0].date : "9999";
      return first(a).localeCompare(first(b));
    });
    setFiles(entries);
  }

  async function onCommit() {
    const messages: string[] = [];
    let ok = true;
    let importedHoldings = false;

    for (const f of files) {
      const { parsed } = f;
      if (parsed.kind === "snapshots") {
        upsertSnapshots(parsed.rows.map((r) => ({ ...r })), "import");
        messages.push(`${f.name}: 資産スナップショット ${parsed.rows.length}件`);
      } else if (parsed.kind === "transactions") {
        if (parsed.rows.length === 0) {
          messages.push(`${f.name}: 取り込める明細なし`);
          continue;
        }
        const dates = parsed.rows.map((r) => r.date).sort();
        replaceTransactionsInRange(parsed.rows);
        messages.push(`${f.name}: 入出金明細 ${parsed.rows.length}件（${dates[0]}〜${dates[dates.length - 1]}）`);
      } else if (parsed.kind === "holdings") {
        if (!accountId) {
          messages.push(`${f.name}: ⚠️ 取り込み先の口座が未選択のためスキップ`);
          ok = false;
          continue;
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
        importedHoldings = true;
        messages.push(`${f.name}: 保有資産 ${parsed.rows.length}件（${mode === "replace" ? "洗い替え" : "追加"}）`);
      } else {
        messages.push(`${f.name}: ⚠️ 形式を判定できずスキップ`);
        ok = false;
      }
    }

    // 保有資産を取り込んだ場合は最新データでスナップショットも記録
    if (importedHoldings) {
      const bundle = await loadMarketBundle();
      const fresh = computePortfolio(loadData(), (t, n) => quoteFromBundle(bundle, t, n));
      const date = today();
      upsertSnapshots(
        Object.entries(fresh.byClass)
          .filter(([, v]) => v != null && v !== 0)
          .map(([category, amount]) => ({ date, category, amount: amount! })),
        "auto",
      );
      messages.push(`本日（${date}）のスナップショットを記録しました`);
    }

    // 入出金明細の取込カバレッジを表示
    const coverage = transactionCoverage(loadData().transactions);
    if (coverage.months.length > 0) {
      messages.push(
        `取込済みの入出金明細: ${coverage.months[0].replace("-", "/")}〜${coverage.months[coverage.months.length - 1].replace("-", "/")}（${coverage.months.length}ヶ月分）`,
      );
      if (coverage.missing.length > 0) {
        messages.push(
          `⚠️ 未取込の月: ${coverage.missing.map((m) => m.replace("-", "/")).join("・")} — 歯抜けがあると推移の推計が不正確になります`,
        );
      }
    }

    setResult({ ok, messages });
    setFiles([]);
  }

  const inputCls =
    "rounded-lg border border-[var(--axis)] bg-white px-2.5 py-1.5 text-sm focus:border-[var(--series-1)] focus:outline-none";
  const hasHoldings = files.some((f) => f.parsed.kind === "holdings");
  const hasValid = files.some((f) => f.parsed.kind !== "unknown");
  const single = files.length === 1 ? files[0] : null;

  return (
    <div className="space-y-4">
      <label className="block cursor-pointer rounded-xl border-2 border-dashed border-[var(--axis)] bg-[var(--surface)] p-10 text-center transition-colors hover:border-[var(--series-1)]">
        <input
          type="file"
          accept=".csv,text/csv"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) void onSelectFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <div className="text-3xl">📄</div>
        <div className="mt-2 font-medium">CSVファイルを選択（複数可）</div>
        <div className="mt-1 text-xs text-[var(--ink-muted)]">
          マネーフォワードMEの月次入出金CSVは<strong>複数月分まとめて</strong>選択できます。
          SBI証券・楽天証券の保有商品CSVにも対応（Shift_JIS自動判定・ブラウザ内処理）。
        </div>
      </label>

      {result && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            result.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          <ul className="space-y-0.5">
            {result.messages.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </div>
      )}

      {files.length > 0 && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
          {single ? (
            <h2 className="text-sm font-semibold">
              判定された形式: <span className="text-[var(--series-1)]">{KIND_LABEL[single.parsed.kind]}</span>
              {single.parsed.kind !== "unknown" && (
                <span className="ml-2 text-xs font-normal text-[var(--ink-muted)]">{single.parsed.rows.length}件</span>
              )}
            </h2>
          ) : (
            <h2 className="text-sm font-semibold">{files.length}ファイルを一括取り込み</h2>
          )}

          {/* 複数ファイル時はファイル別サマリー */}
          {!single && (
            <table className="mt-3 w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--grid)] text-left text-[var(--ink-muted)]">
                  <th className="py-1.5 pr-4 font-medium">ファイル</th>
                  <th className="py-1.5 pr-4 font-medium">形式</th>
                  <th className="py-1.5 pr-4 text-right font-medium">件数</th>
                  <th className="py-1.5 font-medium">期間</th>
                </tr>
              </thead>
              <tbody>
                {files.map((f, i) => {
                  const dates =
                    f.parsed.kind !== "unknown" && f.parsed.rows.length > 0 && "date" in f.parsed.rows[0]
                      ? (f.parsed.rows as { date: string }[]).map((r) => r.date).sort()
                      : [];
                  return (
                    <tr key={i} className="border-b border-[var(--grid)] last:border-0">
                      <td className="py-1.5 pr-4">{f.name}</td>
                      <td className="py-1.5 pr-4">{KIND_LABEL[f.parsed.kind]}</td>
                      <td className="py-1.5 pr-4 text-right tabular">
                        {f.parsed.kind !== "unknown" ? f.parsed.rows.length : "−"}
                      </td>
                      <td className="py-1.5 text-[var(--ink-secondary)]">
                        {dates.length > 0 ? `${dates[0]} 〜 ${dates[dates.length - 1]}` : "−"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* 単一ファイル時は内容プレビュー */}
          {single && single.parsed.kind === "unknown" && (
            <div className="mt-3 text-sm text-[var(--ink-secondary)]">
              <p>このCSVの形式を判定できませんでした。検出されたヘッダー:</p>
              <code className="mt-1 block rounded bg-[var(--page)] p-2 text-xs">
                {single.parsed.headers?.join(", ")}
              </code>
            </div>
          )}
          {single && single.sample.length > 0 && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[var(--grid)] text-left text-[var(--ink-muted)]">
                    {Object.keys(single.sample[0]).map((k) => (
                      <th key={k} className="py-1.5 pr-4 font-medium">{k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {single.sample.map((row, i) => (
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

          {hasValid && (
            <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-[var(--grid)] pt-4">
              {hasHoldings && (
                <>
                  <label className="text-xs text-[var(--ink-secondary)]">
                    取り込み先の口座（保有資産CSV用）
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
                onClick={() => void onCommit()}
                disabled={hasHoldings && !accountId}
                className="rounded-lg bg-[var(--series-1)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                この内容で取り込む
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
