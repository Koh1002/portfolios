"use server";

import { revalidatePath } from "next/cache";
import { setSetting } from "@/lib/settings";
import { ASSET_CLASSES, type TargetAllocation } from "@/lib/types";

export async function saveTargetAllocation(fd: FormData): Promise<void> {
  const target: TargetAllocation = {};
  for (const c of ASSET_CLASSES) {
    const v = Number(String(fd.get(c) ?? "").trim());
    if (isFinite(v) && v > 0) target[c] = v;
  }
  setSetting("targetAllocation", target);
  revalidatePath("/rebalance");
  revalidatePath("/");
}
