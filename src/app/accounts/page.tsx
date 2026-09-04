"use client";

import type { FormEvent } from "react";
import { usePortfolio } from "@/lib/use-portfolio";
import {
  addAccount,
  addHolding,
  deleteAccount,
  deleteHolding,
  updateHolding,
  upsertSnapshots,
} from "@/lib/store";
import {
  ACCOUNT_TYPE_LABEL,
  ASSET_CLASS_LABEL,
  NISA_LABEL,
  type AccountType,
  type AssetClass,
  type NisaType,
} from "@/lib/types";
import { yen, num, today } from "@/lib/format";
import { Card, EmptyState, GainText, Loading, MarketSourceNotice, PageHeader } from "@/components/ui";

const inputCls =
  "rounded-lg border border-[var(--axis)] bg-white px-2.5 py-1.5 text-sm focus:border-[var(--series-1)] focus:outline-none";
const btnPrimary =
  "rounded-lg bg-[var(--series-1)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90";
const btnGhost = "rounded-lg border border-[var(--axis)] px-3 py-1.5 text-sm hover:bg-[var(--page)]";

function fd(e: FormEvent<HTMLFormElement>): FormData {
  e.preventDefault();
  return new FormData(e.currentTarget);
}

function numOrNull(f: FormData, key: string): number | null {
  const v = String(f.get(key) ?? "").trim().replace(/,/g, "");
  if (v === "") return null;
  const n = Number(v);
  return isFinite(n) ? n : null;
}

export default function AccountsPage() {
  const { ready, portfolio, marketDateLabel } = usePortfolio();
  if (!ready) return <Loading />;

  const onAddAccount = (e: FormEvent<HTMLFormElement>) => {
    const f = fd(e);
    const name = String(f.get("name") ?? "").trim();
    if (!name) return;
    addAccount({
      name,
      institution: String(f.get("institution") ?? "").trim(),
      type: String(f.get("type") ?? "other"),
    });
    (e.target as HTMLFormElement).reset();
  };

  const onAddHolding = (accountId: number) => (e: FormEvent<HTMLFormElement>) => {
    const f = fd(e);
    const name = String(f.get("name") ?? "").trim();
    if (!name) return;
    addHolding({
      accountId,
      assetType: String(f.get("assetType") ?? "stock") as AssetClass,
      ticker: String(f.get("ticker") ?? "").trim() || null,
      name,
      quantity: numOrNull(f, "quantity") ?? 0,
      avgCost: numOrNull(f, "avgCost"),
      manualValue: numOrNull(f, "manualValue"),
      nisa: String(f.get("nisa") ?? "none") as NisaType,
    });
    (e.target as HTMLFormElement).reset();
  };

  const onUpdateHolding = (id: number) => (e: FormEvent<HTMLFormElement>) => {
    const f = fd(e);
    updateHolding(id, {
      quantity: numOrNull(f, "quantity") ?? 0,
      avgCost: numOrNull(f, "avgCost"),
      manualValue: numOrNull(f, "manualValue"),
      nisa: String(f.get("nisa") ?? "none") as NisaType,
    });
  };

  const onSnapshot = (e: FormEvent<HTMLFormElement>) => {
    const f = fd(e);
    const date = String(f.get("date") ?? "").trim() || today();
    const rows = Object.entries(portfolio.byClass)
      .filter(([, amount]) => amount != null && amount !== 0)
      .map(([category, amount]) => ({ date, category, amount: amount! }));
    upsertSnapshots(rows, "manual");
  };

  return (
    <div>
      <PageHeader
        title="口座・資産"
        description="金融機関口座と保有資産の登録・編集"
        action={
          <form onSubmit={onSnapshot} className="flex items-end gap-2">
            <label className="text-xs text-[var(--ink-secondary)]">
              基準日
              <input type="date" name="date" defaultValue={today()} className={`${inputCls} mt-1 block`} />
            </label>
            <button
              className={btnGhost}
              title="現在登録されている資産の評価額を、この基準日時点の断面として記録します（入出金からの推移推計の基準になります）"
            >
              📸 スナップショット記録
            </button>
          </form>
        }
      />
      <MarketSourceNotice sources={portfolio.marketSources} dateLabel={marketDateLabel} />

      <Card title="口座を追加" className="mb-5">
        <form onSubmit={onAddAccount} className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-[var(--ink-secondary)]">
            口座名
            <input name="name" required placeholder="例: SBI証券" className={`${inputCls} mt-1 block w-44`} />
          </label>
          <label className="text-xs text-[var(--ink-secondary)]">
            金融機関
            <input name="institution" placeholder="例: SBI証券" className={`${inputCls} mt-1 block w-40`} />
          </label>
          <label className="text-xs text-[var(--ink-secondary)]">
            種別
            <select name="type" className={`${inputCls} mt-1 block w-32`}>
              {Object.entries(ACCOUNT_TYPE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>
          <button className={btnPrimary}>追加</button>
        </form>
      </Card>

      {portfolio.accounts.length === 0 ? (
        <EmptyState title="口座がまだありません">上のフォームから口座を追加するか、CSVインポートをご利用ください</EmptyState>
      ) : (
        <div className="space-y-5">
          {portfolio.accounts.map((account) => {
            const rows = portfolio.holdings.filter((h) => h.accountId === account.id);
            const total = rows.reduce((s, h) => s + h.value, 0);
            return (
              <Card
                key={account.id}
                title={
                  <span className="flex items-center justify-between">
                    <span className="text-base font-bold text-[var(--ink)]">
                      {account.name}
                      <span className="ml-2 text-xs font-normal text-[var(--ink-muted)]">
                        {ACCOUNT_TYPE_LABEL[account.type as AccountType] ?? account.type}
                        {account.institution && ` / ${account.institution}`}
                      </span>
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="tabular text-base font-bold text-[var(--ink)]">{yen(total)}</span>
                      <button
                        onClick={() => {
                          if (confirm(`口座「${account.name}」とその保有資産を削除しますか？`)) deleteAccount(account.id);
                        }}
                        className="text-xs text-[var(--bad)] hover:underline"
                      >
                        口座を削除
                      </button>
                    </span>
                  </span>
                }
              >
                {rows.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[var(--grid)] text-left text-xs text-[var(--ink-muted)]">
                          <th className="py-1.5 font-medium">種別</th>
                          <th className="py-1.5 font-medium">銘柄</th>
                          <th className="py-1.5 text-right font-medium">数量</th>
                          <th className="py-1.5 text-right font-medium">取得単価</th>
                          <th className="py-1.5 text-right font-medium">現在値</th>
                          <th className="py-1.5 text-right font-medium">評価額</th>
                          <th className="py-1.5 text-right font-medium">評価損益</th>
                          <th className="py-1.5 font-medium">口座区分</th>
                          <th className="py-1.5" />
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((h) => (
                          <tr key={h.id} className="border-b border-[var(--grid)] last:border-0">
                            <td className="py-2 text-xs text-[var(--ink-secondary)]">
                              {ASSET_CLASS_LABEL[h.assetType as AssetClass] ?? h.assetType}
                            </td>
                            <td className="py-2">
                              <span className="font-medium">{h.name}</span>
                              {h.ticker && <span className="ml-1.5 text-xs text-[var(--ink-muted)]">{h.ticker}</span>}
                            </td>
                            <td className="py-2 text-right tabular">{num(h.quantity, 2)}</td>
                            <td className="py-2 text-right tabular">{h.avgCost != null ? yen(h.avgCost) : "−"}</td>
                            <td className="py-2 text-right tabular">{h.quote ? yen(h.quote.price) : "−"}</td>
                            <td className="py-2 text-right tabular font-medium">{yen(h.value)}</td>
                            <td className="py-2 text-right">
                              <GainText value={h.gain} pct={h.gainPct} />
                            </td>
                            <td className="py-2 text-xs text-[var(--ink-secondary)]">
                              {NISA_LABEL[h.nisa as NisaType] ?? h.nisa}
                            </td>
                            <td className="py-2 text-right">
                              <details className="relative inline-block text-left">
                                <summary className="cursor-pointer text-xs text-[var(--series-1)] hover:underline">編集</summary>
                                <div className="absolute right-0 z-10 mt-1 w-72 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-lg">
                                  <form onSubmit={onUpdateHolding(h.id)} className="space-y-2">
                                    <label className="block text-xs text-[var(--ink-secondary)]">
                                      数量
                                      <input name="quantity" defaultValue={h.quantity} className={`${inputCls} mt-1 block w-full`} />
                                    </label>
                                    <label className="block text-xs text-[var(--ink-secondary)]">
                                      平均取得単価（円）
                                      <input name="avgCost" defaultValue={h.avgCost ?? ""} className={`${inputCls} mt-1 block w-full`} />
                                    </label>
                                    <label className="block text-xs text-[var(--ink-secondary)]">
                                      評価額の手動指定（円・投信等）
                                      <input name="manualValue" defaultValue={""} placeholder="空欄なら自動計算" className={`${inputCls} mt-1 block w-full`} />
                                    </label>
                                    <label className="block text-xs text-[var(--ink-secondary)]">
                                      口座区分
                                      <select name="nisa" defaultValue={h.nisa} className={`${inputCls} mt-1 block w-full`}>
                                        {Object.entries(NISA_LABEL).map(([k, v]) => (
                                          <option key={k} value={k}>{v}</option>
                                        ))}
                                      </select>
                                    </label>
                                    <button className={`${btnPrimary} w-full`}>保存</button>
                                  </form>
                                  <button
                                    onClick={() => deleteHolding(h.id)}
                                    className="mt-2 w-full text-center text-xs text-[var(--bad)] hover:underline"
                                  >
                                    この資産を削除
                                  </button>
                                </div>
                              </details>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <details className="mt-3">
                  <summary className="cursor-pointer text-sm text-[var(--series-1)] hover:underline">＋ 資産を追加</summary>
                  <form onSubmit={onAddHolding(account.id)} className="mt-3 flex flex-wrap items-end gap-3 rounded-lg bg-[var(--page)] p-3">
                    <label className="text-xs text-[var(--ink-secondary)]">
                      種別
                      <select name="assetType" className={`${inputCls} mt-1 block w-28`}>
                        {Object.entries(ASSET_CLASS_LABEL).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs text-[var(--ink-secondary)]">
                      証券コード
                      <input name="ticker" placeholder="7203（株式のみ）" className={`${inputCls} mt-1 block w-32`} />
                    </label>
                    <label className="text-xs text-[var(--ink-secondary)]">
                      名称
                      <input name="name" required placeholder="例: トヨタ自動車" className={`${inputCls} mt-1 block w-44`} />
                    </label>
                    <label className="text-xs text-[var(--ink-secondary)]">
                      数量
                      <input name="quantity" placeholder="100" className={`${inputCls} mt-1 block w-24`} />
                    </label>
                    <label className="text-xs text-[var(--ink-secondary)]">
                      平均取得単価
                      <input name="avgCost" placeholder="2500" className={`${inputCls} mt-1 block w-28`} />
                    </label>
                    <label className="text-xs text-[var(--ink-secondary)]">
                      評価額（投信・現金等）
                      <input name="manualValue" placeholder="500000" className={`${inputCls} mt-1 block w-32`} />
                    </label>
                    <label className="text-xs text-[var(--ink-secondary)]">
                      口座区分
                      <select name="nisa" className={`${inputCls} mt-1 block w-36`}>
                        {Object.entries(NISA_LABEL).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    </label>
                    <button className={btnPrimary}>追加</button>
                  </form>
                </details>
              </Card>
            );
          })}
        </div>
      )}

      <p className="mt-5 text-xs text-[var(--ink-muted)]">
        💡 現金・預金は「種別: 現金・預金」で数量に金額を入れるか、評価額欄に金額を入力してください。
        投資信託は評価額欄に現在の評価額を入力すると総資産に反映されます（証券コード付きの株式は株価から自動評価）。
        データはこの端末のブラウザ内にのみ保存されます。
      </p>
    </div>
  );
}
