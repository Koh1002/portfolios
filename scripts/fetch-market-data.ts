// 市場データ取得スクリプト（GitHub Actions から毎日実行）
//   npx tsx scripts/fetch-market-data.ts          … Yahoo Finance から取得
//   npx tsx scripts/fetch-market-data.ts --mock   … サンプルデータで生成（オフライン検証用）
//
// 対象: 銘柄提案ユニバース全銘柄 + scripts/extra-tickers.json の追加銘柄
// 出力: public/market/market.json（クライアントが fetch して利用）

import fs from "node:fs";
import path from "node:path";
import { STOCK_UNIVERSE } from "../src/data/stock-universe";
import { generateMockMarket } from "../src/data/mock-market";
import { mapQuote, mapFundamentals, toYahooSymbol } from "../src/lib/yahoo-map";
import type { Fundamentals, QuoteData } from "../src/lib/types";

const MOCK = process.argv.includes("--mock");
const OUT_PATH = path.join(process.cwd(), "public", "market", "market.json");

type Bundle = {
  generatedAt: string;
  mode: "live" | "mock";
  quotes: Record<string, QuoteData>;
  fundamentals: Record<string, Fundamentals>;
};

function targetTickers(): { code: string; name?: string }[] {
  const universe: { code: string; name?: string }[] = STOCK_UNIVERSE.map((s) => ({
    code: s.code,
    name: s.name,
  }));
  try {
    const extra = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "scripts", "extra-tickers.json"), "utf8"),
    ) as { tickers?: string[] };
    for (const code of extra.tickers ?? []) {
      if (!universe.some((u) => u.code === code)) universe.push({ code });
    }
  } catch {
    // extra-tickers.json が無い/壊れている場合はユニバースのみ
  }
  return universe;
}

async function main() {
  const tickers = targetTickers();
  const bundle: Bundle = {
    generatedAt: new Date().toISOString(),
    mode: MOCK ? "mock" : "live",
    quotes: {},
    fundamentals: {},
  };
  let ok = 0;
  let failed = 0;

  if (MOCK) {
    for (const t of tickers) {
      const mock = generateMockMarket(t.code, t.name);
      bundle.quotes[t.code] = mock.quote;
      bundle.fundamentals[t.code] = mock.fundamentals;
      ok++;
    }
  } else {
    const { default: YahooFinance } = await import("yahoo-finance2");
    const yahoo = new YahooFinance({ suppressNotices: ["yahooSurvey", "ripHistorical"] });

    for (const t of tickers) {
      const symbol = toYahooSymbol(t.code);
      try {
        const q = await yahoo.quote(symbol);
        bundle.quotes[t.code] = mapQuote(t.code, q);
        try {
          const qs = await yahoo.quoteSummary(symbol, {
            modules: [
              "financialData",
              "summaryDetail",
              "defaultKeyStatistics",
              "cashflowStatementHistory",
              "incomeStatementHistory",
              "earnings",
              "calendarEvents",
            ],
          });
          bundle.fundamentals[t.code] = mapFundamentals(t.code, qs);
        } catch (e) {
          console.warn(`  ${t.code}: quoteSummary失敗 (${(e as Error).message.slice(0, 80)})`);
        }
        ok++;
        // レート制限対策で少し待つ
        await new Promise((r) => setTimeout(r, 400));
      } catch (e) {
        failed++;
        console.warn(`  ${t.code}: 取得失敗 (${(e as Error).message.slice(0, 80)})`);
      }
    }
  }

  // 全滅時は既存ファイルを壊さない（前回のデータを維持）
  if (ok === 0) {
    console.error("❌ 1銘柄も取得できませんでした。market.json は更新しません。");
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(bundle));
  console.log(
    `✅ market.json を生成しました (${MOCK ? "mock" : "live"}): 株価${ok}件 / 失敗${failed}件 → ${OUT_PATH}`,
  );
}

void main();
