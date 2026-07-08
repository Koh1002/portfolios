// CSVインポートのパーサー群（純粋関数・ユニットテスト対象）
// 対応フォーマット:
//  - マネーフォワードME 資産推移CSV      → 資産スナップショット
//  - マネーフォワードME 家計簿CSV        → 収支明細
//  - マネーフォワードME/SBI証券/楽天証券 保有商品CSV → 保有資産
// 各社のCSVは列名が揺れるため、ヘッダー行のキーワードマッチで列を特定する。

import Papa from "papaparse";
import type { AssetClass, NisaType } from "../types";

export type SnapshotRow = { date: string; category: AssetClass; amount: number };
export type TransactionRow = {
  date: string;
  amount: number;
  category: string;
  subCategory: string;
  description: string;
  institution: string;
};
export type HoldingRow = {
  assetType: AssetClass;
  ticker: string | null;
  name: string;
  quantity: number;
  avgCost: number | null;
  currentValue: number | null; // 評価額（あれば）
  nisa: NisaType;
};

export type ParsedCsv =
  | { kind: "snapshots"; rows: SnapshotRow[] }
  | { kind: "transactions"; rows: TransactionRow[] }
  | { kind: "holdings"; rows: HoldingRow[] }
  | { kind: "unknown"; headers: string[] };

// ── 文字コード判定（UTF-8 / Shift_JIS） ──
// TextDecoder はブラウザ・Node の両方で利用可能（GitHub Pages 静的版でも動く）
export function decodeCsvBuffer(buf: Uint8Array): string {
  const utf8 = new TextDecoder("utf-8").decode(buf);
  let sjis: string;
  try {
    sjis = new TextDecoder("shift_jis").decode(buf);
  } catch {
    sjis = utf8; // shift_jis 非対応環境（通常はない）
  }
  const score = (s: string) => {
    let jp = 0;
    for (const ch of s.slice(0, 4000)) {
      const c = ch.codePointAt(0)!;
      if (c === 0xfffd) jp -= 10; // 置換文字はデコード失敗の証拠
      else if ((c >= 0x3040 && c <= 0x30ff) || (c >= 0x4e00 && c <= 0x9fff)) jp++;
    }
    return jp;
  };
  return score(sjis) > score(utf8) ? sjis : utf8;
}

function parseRows(text: string): string[][] {
  const res = Papa.parse<string[]>(text.replace(/^﻿/, ""), {
    skipEmptyLines: "greedy",
  });
  return (res.data as string[][]).map((r) => r.map((c) => (c ?? "").trim()));
}

export function parseNumber(s: string | undefined | null): number | null {
  if (s == null) return null;
  const cleaned = s.replace(/[",\s円口株ポイントpt]/g, "").replace(/[０-９]/g, (d) => String("０１２３４５６７８９".indexOf(d)));
  if (cleaned === "" || cleaned === "-" || cleaned === "−") return null;
  const v = Number(cleaned.replace("−", "-"));
  return isFinite(v) ? v : null;
}

export function normalizeDate(s: string): string | null {
  const m = s.match(/(\d{4})[/\-年](\d{1,2})[/\-月](\d{1,2})/);
  if (!m) return null;
  return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
}

// ── 列名キーワード ──
const COL = {
  code: ["銘柄コード・ティッカー", "銘柄コード", "ティッカー", "コード"],
  name: ["銘柄名称", "銘柄名", "ファンド名", "商品名", "銘柄", "名称"],
  quantity: ["保有株数", "保有数量", "保有口数", "数量", "口数", "保有数"],
  avgCost: ["平均取得価額", "平均取得単価", "取得単価", "買付平均価格", "取得価額", "参考単価"],
  value: ["時価評価額", "評価金額", "評価額", "時価"],
  nisa: ["預り区分", "口座区分", "口座", "預り"],
  type: ["商品種別", "種別", "種類", "商品"],
} as const;

function findCol(header: string[], keywords: readonly string[]): number {
  for (const kw of keywords) {
    const i = header.findIndex((h) => h.includes(kw));
    if (i >= 0) return i;
  }
  return -1;
}

// ── フォーマット判定 ──
export function detectFormat(text: string): ParsedCsv["kind"] {
  const rows = parseRows(text).slice(0, 30);
  for (const row of rows) {
    const joined = row.join(",");
    if (joined.includes("日付") && (joined.includes("合計") || joined.includes("預金")))
      return "snapshots";
    if (joined.includes("日付") && joined.includes("金額") && joined.includes("大項目"))
      return "transactions";
    const hasName = findCol(row, COL.name) >= 0;
    const hasQtyOrValue = findCol(row, COL.quantity) >= 0 || findCol(row, COL.value) >= 0;
    if (hasName && hasQtyOrValue) return "holdings";
  }
  return "unknown";
}

// ── マネーフォワードME 資産推移CSV ──
// 例: 日付,合計（円）,預金・現金・暗号資産（円）,株式(現物)（円）,投資信託（円）,年金（円）,ポイント（円）
function categoryForColumn(colName: string): AssetClass | null {
  if (colName.includes("合計") || colName.includes("日付")) return null;
  if (colName.includes("預金") || colName.includes("現金")) return "cash";
  if (colName.includes("株式")) return "stock";
  if (colName.includes("投資信託") || colName.includes("投信")) return "fund";
  if (colName.includes("債券")) return "bond";
  if (colName.includes("年金")) return "pension";
  if (colName.includes("ポイント") || colName.includes("マイル")) return "point";
  if (colName.includes("暗号")) return "crypto";
  return "other";
}

export function parseMfTrendCsv(text: string): SnapshotRow[] {
  const rows = parseRows(text);
  const headerIdx = rows.findIndex((r) => r.some((c) => c.includes("日付")));
  if (headerIdx < 0) return [];
  const header = rows[headerIdx];
  const dateCol = header.findIndex((c) => c.includes("日付"));
  const catCols = header
    .map((name, i) => ({ i, cat: categoryForColumn(name) }))
    .filter((c) => c.i !== dateCol && c.cat != null) as { i: number; cat: AssetClass }[];

  const out: SnapshotRow[] = [];
  for (const row of rows.slice(headerIdx + 1)) {
    const date = normalizeDate(row[dateCol] ?? "");
    if (!date) continue;
    // 同一カテゴリの列（例: 株式(現物)と株式(信用)）は合算する
    const byCat = new Map<AssetClass, number>();
    for (const { i, cat } of catCols) {
      const v = parseNumber(row[i]);
      if (v == null) continue;
      byCat.set(cat, (byCat.get(cat) ?? 0) + v);
    }
    for (const [category, amount] of byCat) {
      if (amount !== 0) out.push({ date, category, amount });
    }
  }
  return out;
}

// ── マネーフォワードME 家計簿CSV ──
// 例: 計算対象,日付,内容,金額（円）,保有金融機関,大項目,中項目,メモ,振替,ID
export function parseMfBudgetCsv(text: string): TransactionRow[] {
  const rows = parseRows(text);
  const headerIdx = rows.findIndex(
    (r) => r.some((c) => c.includes("日付")) && r.some((c) => c.includes("金額")),
  );
  if (headerIdx < 0) return [];
  const header = rows[headerIdx];
  const col = (kw: string) => header.findIndex((c) => c.includes(kw));
  const cTarget = col("計算対象");
  const cDate = col("日付");
  const cDesc = col("内容");
  const cAmount = col("金額");
  const cInst = col("保有金融機関");
  const cCat = col("大項目");
  const cSub = col("中項目");
  const cTransfer = col("振替");

  const out: TransactionRow[] = [];
  for (const row of rows.slice(headerIdx + 1)) {
    const date = normalizeDate(row[cDate] ?? "");
    const amount = parseNumber(row[cAmount]);
    if (!date || amount == null) continue;
    if (cTarget >= 0 && row[cTarget] === "0") continue; // 計算対象外
    if (cTransfer >= 0 && row[cTransfer] === "1") continue; // 振替は除外
    out.push({
      date,
      amount,
      category: (cCat >= 0 && row[cCat]) || "未分類",
      subCategory: (cSub >= 0 && row[cSub]) || "",
      description: (cDesc >= 0 && row[cDesc]) || "",
      institution: (cInst >= 0 && row[cInst]) || "",
    });
  }
  return out;
}

// ── 保有商品CSV（マネーフォワード/SBI証券/楽天証券 共通の汎用パーサー） ──
function inferNisa(s: string): NisaType {
  if (/つみたて|積立/.test(s) && /NISA|ニーサ/i.test(s)) return "tsumitate";
  if (/成長/.test(s) && /NISA|ニーサ/i.test(s)) return "growth";
  if (/NISA|ニーサ/i.test(s)) return "general";
  return "none";
}

function inferAssetType(sectionOrType: string, name: string, ticker: string | null): AssetClass {
  const s = sectionOrType + " " + name;
  if (/投資信託|投信|ファンド|fund/i.test(s)) return "fund";
  if (/債券|国債|社債/.test(s)) return "bond";
  if (/現金|預り金|預金|MRF|MMF/.test(s)) return "cash";
  if (/暗号|ビットコイン|BTC|ETH/i.test(s)) return "crypto";
  if (ticker) return "stock";
  if (/株式|現物/.test(s)) return "stock";
  return "fund";
}

export function parseHoldingsCsv(text: string): HoldingRow[] {
  const rows = parseRows(text);
  const out: HoldingRow[] = [];
  let i = 0;
  let section = ""; // 直前のセクション見出し（例: 株式（現物/NISA預り（成長投資枠））)

  while (i < rows.length) {
    const row = rows[i];
    const nameCol = findCol(row, COL.name);
    const qtyCol = findCol(row, COL.quantity);
    const valueCol = findCol(row, COL.value);
    const isHeader = nameCol >= 0 && (qtyCol >= 0 || valueCol >= 0);

    if (!isHeader) {
      // データ行でないセルはセクション見出しとして記憶（SBIのCSVは表の前に見出し行がある）
      const joined = row.filter(Boolean).join(" ");
      if (joined && joined.length < 80) section = joined;
      i++;
      continue;
    }

    const codeCol = findCol(row, COL.code);
    const costCol = findCol(row, COL.avgCost);
    const nisaCol = findCol(row, COL.nisa);
    const typeCol = findCol(row, COL.type);

    i++;
    // ヘッダーに続くデータ行を読む（次のヘッダー/見出しまで）
    for (; i < rows.length; i++) {
      const r = rows[i];
      // 次のセクションヘッダーに到達したら抜ける
      const nextName = findCol(r, COL.name);
      if (nextName >= 0 && (findCol(r, COL.quantity) >= 0 || findCol(r, COL.value) >= 0)) break;

      const name = r[nameCol] ?? "";
      const quantity = qtyCol >= 0 ? parseNumber(r[qtyCol]) : null;
      const value = valueCol >= 0 ? parseNumber(r[valueCol]) : null;
      if (!name || (quantity == null && value == null)) {
        // 空行・合計行など。完全な空行が続いたらセクション終了。
        const joined = r.filter(Boolean).join(" ");
        if (joined && joined.length < 80 && !/合計|小計/.test(joined)) {
          section = joined;
          break;
        }
        continue;
      }
      if (/合計|小計/.test(name)) continue;

      let ticker: string | null = null;
      const codeRaw = codeCol >= 0 ? r[codeCol] : "";
      const codeMatch = (codeRaw || name).match(/\b(\d{4}[A-Z]?)\b/);
      if (codeMatch) ticker = codeMatch[1];
      else if (codeRaw && /^[A-Z.]{1,6}$/.test(codeRaw)) ticker = codeRaw; // 米国株ティッカー

      const nisaSrc = (nisaCol >= 0 ? r[nisaCol] : "") + " " + section;
      const typeSrc = (typeCol >= 0 ? r[typeCol] : "") + " " + section;
      const cleanName = name.replace(/\b\d{4}[A-Z]?\b/, "").replace(/[()（）]/g, " ").trim() || name;

      out.push({
        assetType: inferAssetType(typeSrc, name, ticker),
        ticker,
        name: cleanName,
        quantity: quantity ?? 1,
        avgCost: costCol >= 0 ? parseNumber(r[costCol]) : null,
        currentValue: value,
        nisa: inferNisa(nisaSrc),
      });
    }
  }
  return out;
}

// ── エントリポイント ──
export function parseCsv(buf: Uint8Array): ParsedCsv {
  const text = decodeCsvBuffer(buf);
  const kind = detectFormat(text);
  switch (kind) {
    case "snapshots":
      return { kind, rows: parseMfTrendCsv(text) };
    case "transactions":
      return { kind, rows: parseMfBudgetCsv(text) };
    case "holdings":
      return { kind, rows: parseHoldingsCsv(text) };
    default:
      return { kind: "unknown", headers: parseRows(text)[0] ?? [] };
  }
}
