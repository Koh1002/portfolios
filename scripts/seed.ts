// サンプルデータ投入スクリプト: npm run seed
// 動作確認用に口座・保有資産・資産推移・収支明細を投入する（既存データは削除）

import { db, accounts, holdings, assetSnapshots, transactions } from "../src/db";

const now = new Date();
const nowIso = now.toISOString();

function monthsAgo(n: number): string {
  const d = new Date(now);
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 10);
}

// ── 既存データをクリア ──
db.delete(holdings).run();
db.delete(accounts).run();
db.delete(assetSnapshots).run();
db.delete(transactions).run();

// ── 口座 ──
const [bank] = db
  .insert(accounts)
  .values({ name: "三菱UFJ銀行", institution: "三菱UFJ銀行", type: "bank", createdAt: nowIso })
  .returning()
  .all();
const [sbi] = db
  .insert(accounts)
  .values({ name: "SBI証券", institution: "SBI証券", type: "securities", createdAt: nowIso })
  .returning()
  .all();
const [rakuten] = db
  .insert(accounts)
  .values({ name: "楽天証券", institution: "楽天証券", type: "securities", createdAt: nowIso })
  .returning()
  .all();

// ── 保有資産 ──
db.insert(holdings)
  .values([
    // 銀行: 現金
    { accountId: bank.id, assetType: "cash", ticker: null, name: "普通預金", quantity: 1, avgCost: null, manualValue: 2_500_000, nisa: "none", updatedAt: nowIso },
    // SBI証券: 個別株（課税口座）
    { accountId: sbi.id, assetType: "stock", ticker: "7203", name: "トヨタ自動車", quantity: 100, avgCost: 2650, manualValue: null, nisa: "none", updatedAt: nowIso },
    { accountId: sbi.id, assetType: "stock", ticker: "8058", name: "三菱商事", quantity: 200, avgCost: 2400, manualValue: null, nisa: "none", updatedAt: nowIso },
    { accountId: sbi.id, assetType: "stock", ticker: "9433", name: "KDDI", quantity: 100, avgCost: 4300, manualValue: null, nisa: "none", updatedAt: nowIso },
    { accountId: sbi.id, assetType: "stock", ticker: "6758", name: "ソニーグループ", quantity: 100, avgCost: 2900, manualValue: null, nisa: "growth", updatedAt: nowIso },
    { accountId: sbi.id, assetType: "stock", ticker: "8035", name: "東京エレクトロン", quantity: 10, avgCost: 22000, manualValue: null, nisa: "none", updatedAt: nowIso },
    // 楽天証券: つみたてNISAの投信
    { accountId: rakuten.id, assetType: "fund", ticker: null, name: "eMAXIS Slim 全世界株式（オール・カントリー）", quantity: 800_000, avgCost: null, manualValue: 1_650_000, nisa: "tsumitate", updatedAt: nowIso },
    { accountId: rakuten.id, assetType: "fund", ticker: null, name: "eMAXIS Slim 米国株式（S&P500）", quantity: 400_000, avgCost: null, manualValue: 980_000, nisa: "tsumitate", updatedAt: nowIso },
  ])
  .run();

// ── 資産推移スナップショット（過去12ヶ月、ゆるやかな成長） ──
const base = { cash: 2_300_000, stock: 2_800_000, fund: 1_900_000 };
for (let m = 12; m >= 0; m--) {
  const date = monthsAgo(m);
  const growth = Math.pow(1.008, 12 - m); // 月0.8%成長
  const wiggle = 1 + Math.sin((12 - m) * 1.3) * 0.02;
  const values: Record<string, number> = {
    cash: base.cash + (12 - m) * 15_000,
    stock: Math.round(base.stock * growth * wiggle),
    fund: Math.round(base.fund * Math.pow(1.01, 12 - m)),
  };
  for (const [category, amount] of Object.entries(values)) {
    db.insert(assetSnapshots)
      .values({ date, category, amount, source: "import" })
      .onConflictDoUpdate({ target: [assetSnapshots.date, assetSnapshots.category], set: { amount } })
      .run();
  }
}

// ── 収支明細（直近3ヶ月） ──
const budgetRows: (typeof transactions.$inferInsert)[] = [];
for (let m = 2; m >= 0; m--) {
  const ym = monthsAgo(m).slice(0, 8);
  budgetRows.push(
    { date: `${ym}25`, amount: 320_000, category: "収入", subCategory: "給与", description: "給与", institution: "三菱UFJ銀行" },
    { date: `${ym}03`, amount: -82_000, category: "住宅", subCategory: "家賃", description: "家賃", institution: "三菱UFJ銀行" },
    { date: `${ym}10`, amount: -46_000, category: "食費", subCategory: "食料品", description: "スーパー等", institution: "楽天カード" },
    { date: `${ym}15`, amount: -12_000, category: "水道・光熱費", subCategory: "電気", description: "電気代", institution: "楽天カード" },
    { date: `${ym}18`, amount: -9_800, category: "通信費", subCategory: "携帯電話", description: "スマホ料金", institution: "楽天カード" },
    { date: `${ym}20`, amount: -25_000, category: "趣味・娯楽", subCategory: "", description: "外食・レジャー", institution: "楽天カード" },
    { date: `${ym}27`, amount: -50_000, category: "貯金・投資", subCategory: "積立", description: "つみたてNISA", institution: "楽天証券" },
  );
}
for (const r of budgetRows) db.insert(transactions).values(r).run();

console.log("✅ サンプルデータを投入しました:");
console.log("  - 口座3件（三菱UFJ銀行 / SBI証券 / 楽天証券）");
console.log("  - 保有資産8件（個別株5・投信2・現金1）");
console.log("  - 資産推移スナップショット13ヶ月分");
console.log(`  - 収支明細${budgetRows.length}件（3ヶ月分）`);
console.log("npm run dev で http://localhost:3000 を開いてください。");
