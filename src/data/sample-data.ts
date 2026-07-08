// サンプルデータ（「サンプルデータを読み込む」ボタンで localStorage に投入）

import type { PortfolioData } from "@/lib/store";
import { emptyData } from "@/lib/store";

function monthsAgo(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 10);
}

export function buildSampleData(): PortfolioData {
  const data = emptyData();
  const nowIso = new Date().toISOString();
  let id = 1;

  const bankId = id++;
  const sbiId = id++;
  const rakutenId = id++;
  data.accounts = [
    { id: bankId, name: "三菱UFJ銀行", institution: "三菱UFJ銀行", type: "bank", createdAt: nowIso },
    { id: sbiId, name: "SBI証券", institution: "SBI証券", type: "securities", createdAt: nowIso },
    { id: rakutenId, name: "楽天証券", institution: "楽天証券", type: "securities", createdAt: nowIso },
  ];

  data.holdings = [
    { id: id++, accountId: bankId, assetType: "cash", ticker: null, name: "普通預金", quantity: 1, avgCost: null, manualValue: 2_500_000, nisa: "none", updatedAt: nowIso },
    { id: id++, accountId: sbiId, assetType: "stock", ticker: "7203", name: "トヨタ自動車", quantity: 100, avgCost: 2650, manualValue: null, nisa: "none", updatedAt: nowIso },
    { id: id++, accountId: sbiId, assetType: "stock", ticker: "8058", name: "三菱商事", quantity: 200, avgCost: 2400, manualValue: null, nisa: "none", updatedAt: nowIso },
    { id: id++, accountId: sbiId, assetType: "stock", ticker: "9433", name: "KDDI", quantity: 100, avgCost: 4300, manualValue: null, nisa: "none", updatedAt: nowIso },
    { id: id++, accountId: sbiId, assetType: "stock", ticker: "6758", name: "ソニーグループ", quantity: 100, avgCost: 2900, manualValue: null, nisa: "growth", updatedAt: nowIso },
    { id: id++, accountId: sbiId, assetType: "stock", ticker: "8035", name: "東京エレクトロン", quantity: 10, avgCost: 22000, manualValue: null, nisa: "none", updatedAt: nowIso },
    { id: id++, accountId: rakutenId, assetType: "fund", ticker: null, name: "eMAXIS Slim 全世界株式（オール・カントリー）", quantity: 800_000, avgCost: null, manualValue: 1_650_000, nisa: "tsumitate", updatedAt: nowIso },
    { id: id++, accountId: rakutenId, assetType: "fund", ticker: null, name: "eMAXIS Slim 米国株式（S&P500）", quantity: 400_000, avgCost: null, manualValue: 980_000, nisa: "tsumitate", updatedAt: nowIso },
  ];

  // 資産推移（過去12ヶ月、ゆるやかな成長）
  const base = { cash: 2_300_000, stock: 2_800_000, fund: 1_900_000 };
  for (let m = 12; m >= 0; m--) {
    const date = monthsAgo(m);
    const growth = Math.pow(1.008, 12 - m);
    const wiggle = 1 + Math.sin((12 - m) * 1.3) * 0.02;
    data.snapshots.push(
      { date, category: "cash", amount: base.cash + (12 - m) * 15_000, source: "import" },
      { date, category: "stock", amount: Math.round(base.stock * growth * wiggle), source: "import" },
      { date, category: "fund", amount: Math.round(base.fund * Math.pow(1.01, 12 - m)), source: "import" },
    );
  }

  // 収支明細（直近3ヶ月）
  for (let m = 2; m >= 0; m--) {
    const ym = monthsAgo(m).slice(0, 8);
    const rows = [
      { date: `${ym}25`, amount: 320_000, category: "収入", subCategory: "給与", description: "給与", institution: "三菱UFJ銀行" },
      { date: `${ym}03`, amount: -82_000, category: "住宅", subCategory: "家賃", description: "家賃", institution: "三菱UFJ銀行" },
      { date: `${ym}10`, amount: -46_000, category: "食費", subCategory: "食料品", description: "スーパー等", institution: "楽天カード" },
      { date: `${ym}15`, amount: -12_000, category: "水道・光熱費", subCategory: "電気", description: "電気代", institution: "楽天カード" },
      { date: `${ym}18`, amount: -9_800, category: "通信費", subCategory: "携帯電話", description: "スマホ料金", institution: "楽天カード" },
      { date: `${ym}20`, amount: -25_000, category: "趣味・娯楽", subCategory: "", description: "外食・レジャー", institution: "楽天カード" },
      { date: `${ym}27`, amount: -50_000, category: "貯金・投資", subCategory: "積立", description: "つみたてNISA", institution: "楽天証券" },
    ];
    for (const r of rows) data.transactions.push({ ...r, id: id++ });
  }

  data.nextId = id;
  return data;
}
