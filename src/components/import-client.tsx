"use client";

import { useState, useTransition } from "react";
import { commitCsvAction, previewCsvAction, type CommitResult, type PreviewResult } from "@/app/import/actions";

const KIND_LABEL: Record<string, string> = {
  snapshots: "資産推移スナップショット（マネーフォワードME 資産推移CSV）",
  transactions: "収支明細（マネーフォワードME 家計簿CSV）",
  holdings: "保有資産（保有株式・投信などの一覧CSV）",
  unknown: "不明な形式",
};

export function ImportClient({ accounts }: { accounts: { id: number; name: string }[] }) {
  const [base64, setBase64] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [result, setResult] = useState<CommitResult | null>(null);
  const [accountId, setAccountId] = useState<number | undefined>(accounts[0]?.id);
  const [mode, setMode] = useState<"replace" | "append">("replace");
  const [pending, startTransition] = useTransition();

  async function onFile(file: File) {
    setResult(null);
    setFileName(file.name);
    const buf = await file.arrayBuffer();
    let binary = "";
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    const b64 = btoa(binary);
    setBase64(b64);
    startTransition(async () => {
      setPreview(await previewCsvAction(b64));
    });
  }

  function onCommit() {
    if (!base64) return;
    startTransition(async () => {
      const r = await commitCsvAction(base64, { accountId, mode });
      setResult(r);
      if (r.ok) {
        setPreview(null);
        setBase64(null);
      }
    });
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
          }}
        />
        <div className="text-3xl">📄</div>
        <div className="mt-2 font-medium">CSVファイルを選択</div>
        <div className="mt-1 text-xs text-[var(--ink-muted)]">
          マネーフォワードME（資産推移・家計簿・保有資産）／ SBI証券・楽天証券の保有商品CSV に対応（Shift_JIS自動判定）
        </div>
        {fileName && <div className="mt-2 text-sm text-[var(--series-1)]">{fileName}</div>}
      </label>

      {pending && <p className="text-sm text-[var(--ink-muted)]">処理中…</p>}

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
            判定された形式: <span className="text-[var(--series-1)]">{KIND_LABEL[preview.kind]}</span>
            <span className="ml-2 text-xs font-normal text-[var(--ink-muted)]">{preview.count}件</span>
          </h2>

          {preview.kind === "unknown" ? (
            <div className="mt-3 text-sm text-[var(--ink-secondary)]">
              <p>このCSVの形式を判定できませんでした。検出されたヘッダー:</p>
              <code className="mt-1 block rounded bg-[var(--page)] p-2 text-xs">{preview.headers?.join(", ")}</code>
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
                {preview.kind === "holdings" && (
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
                  disabled={pending || (preview.kind === "holdings" && !accountId)}
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
