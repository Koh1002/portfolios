// 設定の読み書き（settings テーブルに JSON で保持）

import { eq } from "drizzle-orm";
import { db, settings } from "@/db";
import {
  DEFAULT_DCF_PARAMS,
  DEFAULT_TARGET_ALLOCATION,
  type DcfParams,
  type TargetAllocation,
} from "./types";

export function getSetting<T>(key: string, fallback: T): T {
  const row = db.select().from(settings).where(eq(settings.key, key)).get();
  if (!row) return fallback;
  try {
    return { ...fallback, ...(JSON.parse(row.json) as T) };
  } catch {
    return fallback;
  }
}

export function setSetting(key: string, value: unknown): void {
  const json = JSON.stringify(value);
  db.insert(settings)
    .values({ key, json })
    .onConflictDoUpdate({ target: settings.key, set: { json } })
    .run();
}

export function getDcfParams(): DcfParams {
  return getSetting<DcfParams>("dcfParams", DEFAULT_DCF_PARAMS);
}

export function getTargetAllocation(): TargetAllocation {
  const row = db.select().from(settings).where(eq(settings.key, "targetAllocation")).get();
  if (!row) return DEFAULT_TARGET_ALLOCATION;
  try {
    return JSON.parse(row.json) as TargetAllocation;
  } catch {
    return DEFAULT_TARGET_ALLOCATION;
  }
}
