// ブラウザ localStorage ベースのデータストア（GitHub Pages 静的版）
// 資産データは端末のブラウザ内にのみ保存され、サーバーには送信されない。

import type { AssetClass, DcfParams, NisaType, TargetAllocation } from "./types";
import { DEFAULT_DCF_PARAMS, DEFAULT_TARGET_ALLOCATION } from "./types";

export type Account = {
  id: number;
  name: string;
  institution: string;
  type: string;
  createdAt: string;
};

export type Holding = {
  id: number;
  accountId: number;
  assetType: AssetClass;
  ticker: string | null;
  name: string;
  quantity: number;
  avgCost: number | null;
  manualValue: number | null;
  nisa: NisaType;
  updatedAt: string;
};

export type Snapshot = {
  date: string; // YYYY-MM-DD
  category: string;
  amount: number;
  source: string;
};

export type Transaction = {
  id: number;
  date: string;
  amount: number;
  category: string;
  subCategory: string;
  description: string;
  institution: string;
};

export type Settings = {
  dcfParams: DcfParams;
  targetAllocation: TargetAllocation;
};

export type PortfolioData = {
  version: 1;
  nextId: number;
  accounts: Account[];
  holdings: Holding[];
  snapshots: Snapshot[];
  transactions: Transaction[];
  settings: Settings;
};

const STORAGE_KEY = "portfolio-data-v1";

export function emptyData(): PortfolioData {
  return {
    version: 1,
    nextId: 1,
    accounts: [],
    holdings: [],
    snapshots: [],
    transactions: [],
    settings: {
      dcfParams: { ...DEFAULT_DCF_PARAMS },
      targetAllocation: { ...DEFAULT_TARGET_ALLOCATION },
    },
  };
}

// ── ストレージ抽象（テスト時は差し替え可能） ──
type StorageLike = { getItem(k: string): string | null; setItem(k: string, v: string): void };

let storageImpl: StorageLike | null = null;

function storage(): StorageLike | null {
  if (storageImpl) return storageImpl;
  if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
  return null;
}

export function setStorageForTesting(s: StorageLike | null): void {
  storageImpl = s;
  cache = null;
}

// ── 読み書き + 購読 ──
let cache: PortfolioData | null = null;
const listeners = new Set<() => void>();

// SSR/プリレンダー時に参照が安定するよう固定の空データを返す
const EMPTY_DATA: PortfolioData = emptyData();

export function loadData(): PortfolioData {
  if (cache) return cache;
  const s = storage();
  if (!s) return EMPTY_DATA;
  try {
    const raw = s.getItem(STORAGE_KEY);
    if (!raw) {
      cache = emptyData();
    } else {
      const parsed = JSON.parse(raw) as PortfolioData;
      cache = {
        ...emptyData(),
        ...parsed,
        settings: {
          dcfParams: { ...DEFAULT_DCF_PARAMS, ...parsed.settings?.dcfParams },
          targetAllocation: parsed.settings?.targetAllocation ?? { ...DEFAULT_TARGET_ALLOCATION },
        },
      };
    }
  } catch {
    cache = emptyData();
  }
  return cache;
}

function persist(data: PortfolioData): void {
  cache = data;
  const s = storage();
  if (s) {
    try {
      s.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // ストレージ満杯等。メモリ上のデータは維持される。
    }
  }
  listeners.forEach((fn) => fn());
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// 別タブでの変更を反映
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) {
      cache = null;
      loadData();
      listeners.forEach((fn) => fn());
    }
  });
}

function mutate(fn: (draft: PortfolioData) => void): void {
  const data = structuredClone(loadData());
  fn(data);
  persist(data);
}

function nowIso(): string {
  return new Date().toISOString();
}

// ── CRUD ──
export function addAccount(input: { name: string; institution: string; type: string }): void {
  mutate((d) => {
    d.accounts.push({ id: d.nextId++, createdAt: nowIso(), ...input });
  });
}

export function deleteAccount(id: number): void {
  mutate((d) => {
    d.accounts = d.accounts.filter((a) => a.id !== id);
    d.holdings = d.holdings.filter((h) => h.accountId !== id);
  });
}

export function addHolding(input: Omit<Holding, "id" | "updatedAt">): void {
  mutate((d) => {
    d.holdings.push({ ...input, id: d.nextId++, updatedAt: nowIso() });
  });
}

export function addHoldings(inputs: Omit<Holding, "id" | "updatedAt">[], opts?: { replaceAccountId?: number }): void {
  mutate((d) => {
    if (opts?.replaceAccountId != null) {
      d.holdings = d.holdings.filter((h) => h.accountId !== opts.replaceAccountId);
    }
    for (const input of inputs) {
      d.holdings.push({ ...input, id: d.nextId++, updatedAt: nowIso() });
    }
  });
}

export function updateHolding(
  id: number,
  patch: Partial<Pick<Holding, "quantity" | "avgCost" | "manualValue" | "nisa">>,
): void {
  mutate((d) => {
    const h = d.holdings.find((x) => x.id === id);
    if (h) Object.assign(h, patch, { updatedAt: nowIso() });
  });
}

export function deleteHolding(id: number): void {
  mutate((d) => {
    d.holdings = d.holdings.filter((h) => h.id !== id);
  });
}

// スナップショット（同日・同カテゴリは上書き）
export function upsertSnapshots(rows: Omit<Snapshot, "source">[] | Snapshot[], source = "manual"): void {
  mutate((d) => {
    for (const r of rows) {
      const src = "source" in r && r.source ? r.source : source;
      const existing = d.snapshots.find((s) => s.date === r.date && s.category === r.category);
      if (existing) {
        existing.amount = r.amount;
        existing.source = src;
      } else {
        d.snapshots.push({ date: r.date, category: r.category, amount: r.amount, source: src });
      }
    }
    d.snapshots.sort((a, b) => a.date.localeCompare(b.date));
  });
}

// 収支明細（同期間を洗い替えして重複を防ぐ）
export function replaceTransactionsInRange(rows: Omit<Transaction, "id">[]): void {
  if (rows.length === 0) return;
  const dates = rows.map((r) => r.date).sort();
  const [min, max] = [dates[0], dates[dates.length - 1]];
  mutate((d) => {
    d.transactions = d.transactions.filter((t) => t.date < min || t.date > max);
    for (const r of rows) d.transactions.push({ ...r, id: d.nextId++ });
    d.transactions.sort((a, b) => a.date.localeCompare(b.date));
  });
}

export function saveSettings(patch: Partial<Settings>): void {
  mutate((d) => {
    if (patch.dcfParams) d.settings.dcfParams = patch.dcfParams;
    if (patch.targetAllocation) d.settings.targetAllocation = patch.targetAllocation;
  });
}

// ── バックアップ ──
export function exportJson(): string {
  return JSON.stringify(loadData(), null, 2);
}

export function importJson(json: string): { ok: boolean; message: string } {
  try {
    const parsed = JSON.parse(json) as PortfolioData;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.accounts)) {
      return { ok: false, message: "バックアップファイルの形式が正しくありません。" };
    }
    persist({ ...emptyData(), ...parsed });
    return { ok: true, message: `復元しました（口座${parsed.accounts.length}件・資産${parsed.holdings?.length ?? 0}件）。` };
  } catch {
    return { ok: false, message: "JSONの読み込みに失敗しました。" };
  }
}

export function replaceAllData(data: PortfolioData): void {
  persist(data);
}

export function clearAllData(): void {
  persist(emptyData());
}
