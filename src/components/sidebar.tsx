"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "ダッシュボード", icon: "🏠" },
  { href: "/accounts", label: "口座・資産", icon: "🏦" },
  { href: "/import", label: "CSVインポート", icon: "📥" },
  { href: "/stocks", label: "保有株分析", icon: "📊" },
  { href: "/discover", label: "銘柄をさがす", icon: "🔍" },
  { href: "/dividends", label: "配当カレンダー", icon: "💰" },
  { href: "/rebalance", label: "リバランス", icon: "⚖️" },
  { href: "/simulation", label: "資産シミュレーション", icon: "📈" },
  { href: "/allocation", label: "アロケーション分析", icon: "🧩" },
  { href: "/budget", label: "収支", icon: "🧾" },
  { href: "/settings", label: "設定", icon: "⚙️" },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)]">
      <div className="px-5 py-5">
        <Link href="/" className="block">
          <div className="text-lg font-bold tracking-tight">マイ資産ポートフォリオ</div>
          <div className="mt-0.5 text-[11px] text-[var(--ink-muted)]">Asset Portfolio Manager</div>
        </Link>
      </div>
      <nav className="flex-1 space-y-0.5 px-3 pb-6">
        {NAV.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-[#e8f0fb] font-semibold text-[#1c5cab]"
                  : "text-[var(--ink-secondary)] hover:bg-[var(--page)]"
              }`}
            >
              <span aria-hidden>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-[var(--border)] px-5 py-3 text-[11px] leading-relaxed text-[var(--ink-muted)]">
        株価データ: Yahoo Finance
        <br />
        理論株価・提案は投資判断の参考情報です
      </div>
    </aside>
  );
}
