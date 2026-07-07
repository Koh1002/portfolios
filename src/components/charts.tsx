"use client";

// Recharts のクライアントラッパー群
// 色はグローバルCSSの検証済みパレットと同一の固定値（資産クラス→色は固定割当）

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const SERIES = {
  blue: "#2a78d6",
  aqua: "#1baf7a",
  yellow: "#eda100",
  green: "#008300",
  violet: "#4a3aa7",
  red: "#e34948",
  magenta: "#e87ba4",
  orange: "#eb6834",
  gray: "#898781",
};
const GRID = "#e1e0d9";
const AXIS = "#c3c2b7";
const MUTED = "#898781";

// 資産クラス→色の固定割当（順序ではなくエンティティに紐づける）
export const ASSET_CLASS_COLORS: Record<string, string> = {
  stock: SERIES.blue,
  fund: SERIES.aqua,
  cash: SERIES.yellow,
  bond: SERIES.green,
  crypto: SERIES.violet,
  pension: SERIES.magenta,
  point: SERIES.orange,
  other: SERIES.gray,
};

function yenTick(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_0000_0000_0000) return `${(v / 1_0000_0000_0000).toFixed(1)}兆`;
  if (abs >= 1_0000_0000) return `${Math.round(v / 1_0000_0000)}億`;
  if (abs >= 1_0000) return `${Math.round(v / 1_0000)}万`;
  return `${v}`;
}

function yenFull(v: number): string {
  return `${Math.round(v).toLocaleString("ja-JP")}円`;
}

const tooltipStyle = {
  borderRadius: 8,
  border: `1px solid ${GRID}`,
  background: "#fcfcfb",
  fontSize: 12,
};

// ── 資産推移（エリアチャート） ──
export function TrendChart({ data }: { data: { date: string; total: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SERIES.blue} stopOpacity={0.25} />
            <stop offset="100%" stopColor={SERIES.blue} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: MUTED }} stroke={AXIS} tickLine={false} minTickGap={40} />
        <YAxis tickFormatter={yenTick} tick={{ fontSize: 11, fill: MUTED }} stroke={AXIS} tickLine={false} width={52} />
        <Tooltip formatter={(v) => [yenFull(Number(v)), "総資産"]} contentStyle={tooltipStyle} />
        <Area type="monotone" dataKey="total" stroke={SERIES.blue} strokeWidth={2} fill="url(#trendFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── 内訳（ドーナツ） ──
export function BreakdownPie({
  data,
  height = 240,
}: {
  data: { key?: string; name: string; value: number }[];
  height?: number;
}) {
  const palette = Object.values(SERIES);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius="55%"
          outerRadius="85%"
          paddingAngle={2}
          strokeWidth={2}
          stroke="#fcfcfb"
        >
          {data.map((d, i) => (
            <Cell key={d.name} fill={(d.key && ASSET_CLASS_COLORS[d.key]) || palette[i % palette.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(v, name) => [yenFull(Number(v)), String(name)]} contentStyle={tooltipStyle} />
        <Legend iconSize={10} formatter={(v) => <span style={{ fontSize: 12, color: "#52514e" }}>{v}</span>} />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ── 月別配当（棒グラフ） ──
export function DividendBars({ data }: { data: { label: string; net: number; tax: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: MUTED }} stroke={AXIS} tickLine={false} />
        <YAxis tickFormatter={yenTick} tick={{ fontSize: 11, fill: MUTED }} stroke={AXIS} tickLine={false} width={52} />
        <Tooltip formatter={(v, name) => [yenFull(Number(v)), name === "net" ? "手取り" : "税金"]} contentStyle={tooltipStyle} />
        <Legend iconSize={10} formatter={(v) => <span style={{ fontSize: 12, color: "#52514e" }}>{v === "net" ? "手取り" : "税金"}</span>} />
        <Bar dataKey="net" stackId="d" fill={SERIES.blue} radius={[0, 0, 0, 0]} />
        <Bar dataKey="tax" stackId="d" fill={SERIES.yellow} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── 四半期業績（売上=棒、純利益=線） ──
export function QuarterlyChart({ data }: { data: { label: string; revenue?: number; earnings?: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: MUTED }} stroke={AXIS} tickLine={false} />
        <YAxis tickFormatter={yenTick} tick={{ fontSize: 11, fill: MUTED }} stroke={AXIS} tickLine={false} width={56} />
        <Tooltip
          formatter={(v, name) => [yenFull(Number(v)), name === "revenue" ? "売上高" : "純利益"]}
          contentStyle={tooltipStyle}
        />
        <Legend iconSize={10} formatter={(v) => <span style={{ fontSize: 12, color: "#52514e" }}>{v === "revenue" ? "売上高" : "純利益"}</span>} />
        <Bar dataKey="revenue" fill={SERIES.blue} radius={[4, 4, 0, 0]} maxBarSize={28} />
        <Line type="monotone" dataKey="earnings" stroke={SERIES.orange} strokeWidth={2} dot={{ r: 3 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// ── 年次業績 ──
export function AnnualChart({ data }: { data: { label: string; revenue?: number; netIncome?: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: MUTED }} stroke={AXIS} tickLine={false} />
        <YAxis tickFormatter={yenTick} tick={{ fontSize: 11, fill: MUTED }} stroke={AXIS} tickLine={false} width={56} />
        <Tooltip
          formatter={(v, name) => [yenFull(Number(v)), name === "revenue" ? "売上高" : "純利益"]}
          contentStyle={tooltipStyle}
        />
        <Legend iconSize={10} formatter={(v) => <span style={{ fontSize: 12, color: "#52514e" }}>{v === "revenue" ? "売上高" : "純利益"}</span>} />
        <Bar dataKey="revenue" fill={SERIES.blue} radius={[4, 4, 0, 0]} maxBarSize={36} />
        <Line type="monotone" dataKey="netIncome" stroke={SERIES.orange} strokeWidth={2} dot={{ r: 3 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// ── シミュレーション（3シナリオ + 元本 + 目標線） ──
export function SimulationChart({
  data,
  target,
}: {
  data: { year: number; pessimistic: number; standard: number; optimistic: number; principal: number }[];
  target?: number | null;
}) {
  const nameMap: Record<string, string> = {
    optimistic: "楽観",
    standard: "標準",
    pessimistic: "悲観",
    principal: "元本",
  };
  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="year" tickFormatter={(v) => `${v}年`} tick={{ fontSize: 11, fill: MUTED }} stroke={AXIS} tickLine={false} />
        <YAxis tickFormatter={yenTick} tick={{ fontSize: 11, fill: MUTED }} stroke={AXIS} tickLine={false} width={56} />
        <Tooltip
          formatter={(v, name) => [yenFull(Number(v)), nameMap[String(name)] ?? String(name)]}
          labelFormatter={(v) => `${v}年後`}
          contentStyle={tooltipStyle}
        />
        <Legend iconSize={10} formatter={(v) => <span style={{ fontSize: 12, color: "#52514e" }}>{nameMap[String(v)] ?? v}</span>} />
        {target != null && target > 0 && (
          <ReferenceLine y={target} stroke={SERIES.red} strokeDasharray="6 4" label={{ value: "目標", fontSize: 11, fill: SERIES.red, position: "insideTopRight" }} />
        )}
        <Line type="monotone" dataKey="optimistic" stroke={SERIES.aqua} strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="standard" stroke={SERIES.blue} strokeWidth={2.5} dot={false} />
        <Line type="monotone" dataKey="pessimistic" stroke={SERIES.orange} strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="principal" stroke={MUTED} strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── 収支（収入・支出の月別棒グラフ） ──
export function BudgetBars({ data }: { data: { label: string; income: number; expense: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: MUTED }} stroke={AXIS} tickLine={false} />
        <YAxis tickFormatter={yenTick} tick={{ fontSize: 11, fill: MUTED }} stroke={AXIS} tickLine={false} width={52} />
        <Tooltip formatter={(v, name) => [yenFull(Number(v)), name === "income" ? "収入" : "支出"]} contentStyle={tooltipStyle} />
        <Legend iconSize={10} formatter={(v) => <span style={{ fontSize: 12, color: "#52514e" }}>{v === "income" ? "収入" : "支出"}</span>} />
        <Bar dataKey="income" fill={SERIES.aqua} radius={[4, 4, 0, 0]} maxBarSize={24} />
        <Bar dataKey="expense" fill={SERIES.red} radius={[4, 4, 0, 0]} maxBarSize={24} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── リバランス乖離（現在% vs 目標%） ──
export function AllocationCompareBars({
  data,
}: {
  data: { label: string; current: number; target: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 0 }}>
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis type="number" tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: MUTED }} stroke={AXIS} tickLine={false} />
        <YAxis type="category" dataKey="label" tick={{ fontSize: 12, fill: "#52514e" }} stroke={AXIS} tickLine={false} width={90} />
        <Tooltip formatter={(v, name) => [`${Number(v).toFixed(1)}%`, name === "current" ? "現在" : "目標"]} contentStyle={tooltipStyle} />
        <Legend iconSize={10} formatter={(v) => <span style={{ fontSize: 12, color: "#52514e" }}>{v === "current" ? "現在" : "目標"}</span>} />
        <Bar dataKey="current" fill={SERIES.blue} radius={[0, 4, 4, 0]} maxBarSize={14} />
        <Bar dataKey="target" fill={SERIES.gray} radius={[0, 4, 4, 0]} maxBarSize={14} />
      </BarChart>
    </ResponsiveContainer>
  );
}
