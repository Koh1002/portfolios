import { beforeEach, describe, expect, it } from "vitest";
import {
  addAccount,
  addHolding,
  addHoldings,
  deleteAccount,
  exportJson,
  importJson,
  loadData,
  replaceTransactionsInRange,
  setStorageForTesting,
  updateHolding,
  upsertSnapshots,
} from "@/lib/store";

// localStorage の簡易モック
function fakeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
  };
}

beforeEach(() => {
  setStorageForTesting(fakeStorage());
});

describe("store: 口座と保有資産", () => {
  it("口座と保有資産を追加・更新・削除できる", () => {
    addAccount({ name: "SBI証券", institution: "SBI証券", type: "securities" });
    const accountId = loadData().accounts[0].id;

    addHolding({
      accountId,
      assetType: "stock",
      ticker: "7203",
      name: "トヨタ自動車",
      quantity: 100,
      avgCost: 2600,
      manualValue: null,
      nisa: "none",
    });
    expect(loadData().holdings).toHaveLength(1);

    const holdingId = loadData().holdings[0].id;
    updateHolding(holdingId, { quantity: 200 });
    expect(loadData().holdings[0].quantity).toBe(200);

    // 口座削除で保有資産も消える
    deleteAccount(accountId);
    expect(loadData().accounts).toHaveLength(0);
    expect(loadData().holdings).toHaveLength(0);
  });

  it("洗い替えインポートは対象口座の既存保有のみ置き換える", () => {
    addAccount({ name: "A", institution: "", type: "securities" });
    addAccount({ name: "B", institution: "", type: "securities" });
    const [a, b] = loadData().accounts.map((x) => x.id);
    addHolding({ accountId: a, assetType: "stock", ticker: "7203", name: "トヨタ", quantity: 100, avgCost: null, manualValue: null, nisa: "none" });
    addHolding({ accountId: b, assetType: "stock", ticker: "6758", name: "ソニー", quantity: 100, avgCost: null, manualValue: null, nisa: "none" });

    addHoldings(
      [{ accountId: a, assetType: "stock", ticker: "8058", name: "三菱商事", quantity: 200, avgCost: null, manualValue: null, nisa: "none" }],
      { replaceAccountId: a },
    );
    const holdings = loadData().holdings;
    expect(holdings).toHaveLength(2);
    expect(holdings.find((h) => h.accountId === a)?.ticker).toBe("8058");
    expect(holdings.find((h) => h.accountId === b)?.ticker).toBe("6758");
  });
});

describe("store: スナップショットと収支", () => {
  it("同日・同カテゴリのスナップショットは上書きされる", () => {
    upsertSnapshots([{ date: "2026-07-01", category: "stock", amount: 100 }], "auto");
    upsertSnapshots([{ date: "2026-07-01", category: "stock", amount: 200 }], "auto");
    upsertSnapshots([{ date: "2026-07-01", category: "cash", amount: 50 }], "auto");
    const snaps = loadData().snapshots;
    expect(snaps).toHaveLength(2);
    expect(snaps.find((s) => s.category === "stock")?.amount).toBe(200);
  });

  it("収支明細は同期間を洗い替えして重複しない", () => {
    replaceTransactionsInRange([
      { date: "2026-06-01", amount: -100, category: "食費", subCategory: "", description: "", institution: "" },
      { date: "2026-06-30", amount: -200, category: "食費", subCategory: "", description: "", institution: "" },
    ]);
    // 同じ期間（6/1〜6/30を含む範囲）を再インポート → 旧明細は置き換え
    replaceTransactionsInRange([
      { date: "2026-06-01", amount: -300, category: "食費", subCategory: "", description: "", institution: "" },
      { date: "2026-06-30", amount: -400, category: "食費", subCategory: "", description: "", institution: "" },
    ]);
    const txs = loadData().transactions;
    expect(txs).toHaveLength(2);
    expect(txs.map((t) => t.amount).sort((a, b) => a - b)).toEqual([-400, -300]);

    // 範囲外の明細は残る
    replaceTransactionsInRange([
      { date: "2026-07-10", amount: -500, category: "食費", subCategory: "", description: "", institution: "" },
    ]);
    expect(loadData().transactions).toHaveLength(3);
  });
});

describe("store: バックアップ", () => {
  it("エクスポート→復元で往復できる", () => {
    addAccount({ name: "SBI証券", institution: "", type: "securities" });
    const json = exportJson();

    setStorageForTesting(fakeStorage()); // 別端末を模擬
    expect(loadData().accounts).toHaveLength(0);
    const result = importJson(json);
    expect(result.ok).toBe(true);
    expect(loadData().accounts[0].name).toBe("SBI証券");
  });

  it("不正なJSONは拒否する", () => {
    expect(importJson("not json").ok).toBe(false);
    expect(importJson('{"foo": 1}').ok).toBe(false);
  });
});
