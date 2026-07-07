// 共通の表示コンポーネント（サーバー/クライアント両用）

import type { ReactNode } from "react";
import type { MarketSource, Verdict } from "@/lib/types";
import { VERDICT_COLOR } from "@/lib/valuation";

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-[var(--ink-secondary)]">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ title, children, className = "" }: { title?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm ${className}`}>
      {title && <h2 className="mb-3 text-sm font-semibold text-[var(--ink-secondary)]">{title}</h2>}
      {children}
    </section>
  );
}

export function StatCard({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "good" | "bad" | "neutral" }) {
  const toneClass = tone === "good" ? "text-[var(--good)]" : tone === "bad" ? "text-[var(--bad)]" : "";
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      <div className="text-xs font-medium text-[var(--ink-muted)]">{label}</div>
      <div className={`mt-1 text-2xl font-bold tabular ${toneClass}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-[var(--ink-secondary)]">{sub}</div>}
    </div>
  );
}

export function VerdictBadge({ verdict }: { verdict: Verdict | null }) {
  if (!verdict) return <span className="text-xs text-[var(--ink-muted)]">判定不可</span>;
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${VERDICT_COLOR[verdict]}`}>
      {verdict}
    </span>
  );
}

const SOURCE_LABEL: Record<MarketSource, { label: string; cls: string }> = {
  live: { label: "リアルタイム", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  cache: { label: "キャッシュ", cls: "bg-slate-100 text-slate-600 border-slate-200" },
  mock: { label: "サンプルデータ", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  none: { label: "取得不可", cls: "bg-slate-100 text-slate-500 border-slate-200" },
};

export function SourceBadge({ source }: { source: MarketSource }) {
  const s = SOURCE_LABEL[source];
  return <span className={`inline-block rounded-full border px-2 py-0.5 text-[11px] ${s.cls}`}>株価: {s.label}</span>;
}

export function MarketSourceNotice({ sources }: { sources: MarketSource[] }) {
  if (!sources.includes("mock")) return null;
  return (
    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
      ⚠️ Yahoo Finance に接続できないため、一部の株価・財務データは<strong>サンプル値</strong>で表示しています。
      ネットワーク接続後に再読み込みすると実データに切り替わります。
    </div>
  );
}

export function Stars({ value }: { value: number }) {
  const full = Math.floor(value);
  const half = value - full >= 0.5;
  return (
    <span className="text-amber-500" title={`${value.toFixed(1)} / 5`}>
      {"★".repeat(full)}
      {half ? "⯨" : ""}
      <span className="text-[var(--grid)]">{"★".repeat(Math.max(0, 5 - full - (half ? 1 : 0)))}</span>
    </span>
  );
}

export function ScoreBar({ label, score }: { label: string; score: number }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-16 shrink-0 text-[var(--ink-muted)]">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--grid)]">
        <div className="h-full rounded-full bg-[var(--series-1)]" style={{ width: `${(score / 5) * 100}%` }} />
      </div>
      <span className="w-8 text-right tabular text-[var(--ink-secondary)]">{score.toFixed(1)}</span>
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--axis)] bg-[var(--surface)] p-10 text-center">
      <p className="font-medium text-[var(--ink-secondary)]">{title}</p>
      {children && <div className="mt-2 text-sm text-[var(--ink-muted)]">{children}</div>}
    </div>
  );
}

export function GainText({ value, pct }: { value: number | null; pct?: number | null }) {
  if (value == null) return <span className="text-[var(--ink-muted)]">−</span>;
  const cls = value > 0 ? "text-[var(--good)]" : value < 0 ? "text-[var(--bad)]" : "";
  const sign = value > 0 ? "+" : "";
  return (
    <span className={`tabular ${cls}`}>
      {sign}
      {Math.round(value).toLocaleString("ja-JP")}円{pct != null && isFinite(pct) && ` (${sign}${pct.toFixed(1)}%)`}
    </span>
  );
}
