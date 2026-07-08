"use server";

import { revalidatePath } from "next/cache";
import { and, eq, gte, lte } from "drizzle-orm";
import { db, assetSnapshots, holdings, transactions } from "@/db";
import { parseCsv, type ParsedCsv } from "@/lib/csv/parse";
import { getPortfolio, recordSnapshotFromPortfolio } from "@/lib/portfolio";
import { nowIso } from "@/lib/format";

export type PreviewResult = {
  kind: ParsedCsv["kind"];
  count: number;
  sample: Record<string, string | number | null>[];
  headers?: string[];
};

function decode(base64: string): Buffer {
  return Buffer.from(base64, "base64");
}

export async function previewCsvAction(base64: string): Promise<PreviewResult> {
  const parsed = parseCsv(decode(base64));
  switch (parsed.kind) {
    case "snapshots":
      return {
        kind: parsed.kind,
        count: parsed.rows.length,
        sample: parsed.rows.slice(0, 8).map((r) => ({ 日付: r.date, カテゴリ: r.category, 金額: r.amount })),
      };
    case "transactions":
      return {
        kind: parsed.kind,
        count: parsed.rows.length,
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
        kind: parsed.kind,
        count: parsed.rows.length,
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
      return { kind: "unknown", count: 0, sample: [], headers: parsed.headers };
  }
}

export type CommitResult = { ok: boolean; message: string };

export async function commitCsvAction(
  base64: string,
  options: { accountId?: number; mode: "replace" | "append" },
): Promise<CommitResult> {
  const parsed = parseCsv(decode(base64));

  if (parsed.kind === "unknown") {
    return { ok: false, message: "CSVの形式を判定できませんでした。対応形式か確認してください。" };
  }

  if (parsed.kind === "snapshots") {
    for (const r of parsed.rows) {
      db.insert(assetSnapshots)
        .values({ date: r.date, category: r.category, amount: r.amount, source: "import" })
        .onConflictDoUpdate({
          target: [assetSnapshots.date, assetSnapshots.category],
          set: { amount: r.amount, source: "import" },
        })
        .run();
    }
    revalidateAll();
    return { ok: true, message: `資産推移スナップショット ${parsed.rows.length}件を取り込みました。` };
  }

  if (parsed.kind === "transactions") {
    if (parsed.rows.length === 0) return { ok: false, message: "取り込める明細がありませんでした。" };
    const dates = parsed.rows.map((r) => r.date).sort();
    const [min, max] = [dates[0], dates[dates.length - 1]];
    // 同一期間の再インポートで重複しないよう、期間内を洗い替え
    db.delete(transactions).where(and(gte(transactions.date, min), lte(transactions.date, max))).run();
    for (const r of parsed.rows) {
      db.insert(transactions).values(r).run();
    }
    revalidateAll();
    return { ok: true, message: `収支明細 ${parsed.rows.length}件を取り込みました（${min}〜${max}の既存明細は置き換え）。` };
  }

  // holdings
  if (!options.accountId) {
    return { ok: false, message: "取り込み先の口座を選択してください。" };
  }
  if (options.mode === "replace") {
    db.delete(holdings).where(eq(holdings.accountId, options.accountId)).run();
  }
  for (const r of parsed.rows) {
    db.insert(holdings)
      .values({
        accountId: options.accountId,
        assetType: r.assetType,
        ticker: r.ticker,
        name: r.name,
        quantity: r.quantity,
        avgCost: r.avgCost,
        manualValue: r.currentValue,
        nisa: r.nisa,
        updatedAt: nowIso(),
      })
      .run();
  }
  // 取り込み後の評価額でスナップショットを自動記録
  const portfolio = await getPortfolio();
  recordSnapshotFromPortfolio(portfolio.byClass);
  revalidateAll();
  return {
    ok: true,
    message: `保有資産 ${parsed.rows.length}件を取り込みました（${options.mode === "replace" ? "洗い替え" : "追加"}）。スナップショットも記録済み。`,
  };
}

function revalidateAll() {
  for (const p of ["/", "/accounts", "/stocks", "/dividends", "/rebalance", "/allocation", "/budget", "/import"]) {
    revalidatePath(p);
  }
}
