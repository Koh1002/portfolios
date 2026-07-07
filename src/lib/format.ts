// 金額・数値の表示ユーティリティ

export function yen(v: number | null | undefined, opts?: { signed?: boolean }): string {
  if (v == null || !isFinite(v)) return "−";
  const sign = opts?.signed && v > 0 ? "+" : "";
  return sign + Math.round(v).toLocaleString("ja-JP") + "円";
}

export function yenCompact(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return "−";
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1_0000_0000_0000) return `${sign}${(abs / 1_0000_0000_0000).toFixed(2)}兆円`;
  if (abs >= 1_0000_0000) return `${sign}${(abs / 1_0000_0000).toFixed(abs >= 100_0000_0000 ? 0 : 2)}億円`;
  if (abs >= 1_0000) return `${sign}${Math.round(abs / 1_0000).toLocaleString("ja-JP")}万円`;
  return `${sign}${Math.round(abs).toLocaleString("ja-JP")}円`;
}

export function pct(v: number | null | undefined, digits = 1, opts?: { signed?: boolean }): string {
  if (v == null || !isFinite(v)) return "−";
  const sign = opts?.signed && v > 0 ? "+" : "";
  return `${sign}${v.toFixed(digits)}%`;
}

export function num(v: number | null | undefined, digits = 0): string {
  if (v == null || !isFinite(v)) return "−";
  return v.toLocaleString("ja-JP", { maximumFractionDigits: digits });
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function nowIso(): string {
  return new Date().toISOString();
}
