"use server";

import { revalidatePath } from "next/cache";
import { setSetting } from "@/lib/settings";
import { DEFAULT_DCF_PARAMS } from "@/lib/types";

export async function saveDcfParams(fd: FormData): Promise<void> {
  const numOr = (key: string, fallback: number, scale = 1) => {
    const v = Number(String(fd.get(key) ?? "").trim());
    return isFinite(v) && v > -100 ? v / scale : fallback;
  };
  setSetting("dcfParams", {
    discountRate: numOr("discountRate", DEFAULT_DCF_PARAMS.discountRate, 100),
    terminalGrowth: numOr("terminalGrowth", DEFAULT_DCF_PARAMS.terminalGrowth, 100),
    years: Math.max(1, Math.min(15, Math.round(numOr("years", DEFAULT_DCF_PARAMS.years)))),
    growthCap: numOr("growthCap", DEFAULT_DCF_PARAMS.growthCap, 100),
    growthFloor: numOr("growthFloor", DEFAULT_DCF_PARAMS.growthFloor, 100),
  });
  for (const p of ["/", "/stocks", "/discover", "/settings"]) revalidatePath(p);
}
