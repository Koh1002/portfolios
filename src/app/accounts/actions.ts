"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, accounts, holdings } from "@/db";
import { nowIso } from "@/lib/format";
import { getPortfolio, recordSnapshotFromPortfolio } from "@/lib/portfolio";

function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

function numOrNull(fd: FormData, key: string): number | null {
  const v = str(fd, key).replace(/,/g, "");
  if (v === "") return null;
  const n = Number(v);
  return isFinite(n) ? n : null;
}

function revalidateAll() {
  for (const p of ["/", "/accounts", "/stocks", "/dividends", "/rebalance", "/allocation", "/simulation"]) {
    revalidatePath(p);
  }
}

export async function createAccount(fd: FormData): Promise<void> {
  const name = str(fd, "name");
  if (!name) return;
  db.insert(accounts)
    .values({ name, institution: str(fd, "institution"), type: str(fd, "type") || "other", createdAt: nowIso() })
    .run();
  revalidateAll();
}

export async function deleteAccount(fd: FormData): Promise<void> {
  const id = Number(fd.get("id"));
  if (!id) return;
  db.delete(holdings).where(eq(holdings.accountId, id)).run();
  db.delete(accounts).where(eq(accounts.id, id)).run();
  revalidateAll();
}

export async function createHolding(fd: FormData): Promise<void> {
  const accountId = Number(fd.get("accountId"));
  const name = str(fd, "name");
  if (!accountId || !name) return;
  db.insert(holdings)
    .values({
      accountId,
      assetType: str(fd, "assetType") || "stock",
      ticker: str(fd, "ticker") || null,
      name,
      quantity: numOrNull(fd, "quantity") ?? 0,
      avgCost: numOrNull(fd, "avgCost"),
      manualValue: numOrNull(fd, "manualValue"),
      nisa: str(fd, "nisa") || "none",
      updatedAt: nowIso(),
    })
    .run();
  revalidateAll();
}

export async function updateHolding(fd: FormData): Promise<void> {
  const id = Number(fd.get("id"));
  if (!id) return;
  db.update(holdings)
    .set({
      quantity: numOrNull(fd, "quantity") ?? 0,
      avgCost: numOrNull(fd, "avgCost"),
      manualValue: numOrNull(fd, "manualValue"),
      nisa: str(fd, "nisa") || "none",
      updatedAt: nowIso(),
    })
    .where(eq(holdings.id, id))
    .run();
  revalidateAll();
}

export async function deleteHolding(fd: FormData): Promise<void> {
  const id = Number(fd.get("id"));
  if (!id) return;
  db.delete(holdings).where(eq(holdings.id, id)).run();
  revalidateAll();
}

// 現在の保有内容から資産スナップショットを記録（資産推移グラフ用）
export async function snapshotNow(): Promise<void> {
  const portfolio = await getPortfolio();
  recordSnapshotFromPortfolio(portfolio.byClass);
  revalidateAll();
}
