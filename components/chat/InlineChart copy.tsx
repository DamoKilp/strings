"use client";

import React, { useMemo } from "react";

export type ChartType = "bar" | "line" | "pie";

export interface ChartSpec {
  type: ChartType;
  title?: string;
  labels?: (string | number)[];
  data: number[] | { x: number | string; y: number }[];
  width?: number;
  height?: number;
  color?: string;
  /** Optional x-axis label text */
  xAxisLabel?: string;
  /** Optional y-axis label text */
  yAxisLabel?: string;
  /** When true, show a simple legend */
  legend?: boolean;
  /** Number of Y ticks (approx). Default: 5 */
  yTickCount?: number;
  /** Show horizontal grid lines at ticks */
  grid?: boolean;
  /** Show numeric data labels near points/bars */
  dataLabels?: boolean;
  /** Optional manual Y-domain min */
  yMin?: number;
  /** Optional manual Y-domain max */
  yMax?: number;
  /** Multi-series datasets; if provided, overrides single-series data for rendering */
  datasets?: Array<{
    label?: string;
    color?: string;
    data: number[] | { x: number | string; y: number }[];
  }>;
  /** Pie/donut options */
  innerRadius?: number; // 0 = pie (default); >0 = donut thickness
  colors?: string[]; // optional palette override for slices
}

interface InlineChartProps {
  spec: ChartSpec;
  className?: string;
}

/**
 * Lightweight, dependency-free inline SVG chart renderer.
 * - Supports simple bar and line charts
 * - Designed for rendering inside markdown/doc previews
 */
export const InlineChart: React.FC<InlineChartProps> = ({ spec, className }) => {
  const {
    type,
    title,
    labels = [],
    data,
    width = 640,
    height = 320,
    color = "#4f46e5",
    xAxisLabel,
    yAxisLabel,
    legend,
    yTickCount = 5,
    grid = true,
    dataLabels = false,
    yMin,
    yMax,
  } = spec;

  type XY = { x: number | string; y: number };

  const seriesList = useMemo(() => {
    const isXY = (v: unknown): v is XY => {
      if (typeof v !== 'object' || v === null) return false;
      const maybe = v as { x?: unknown; y?: unknown };
      const xOk = typeof maybe.x === 'number' || typeof maybe.x === 'string';
      const yOk = typeof maybe.y === 'number';
      return xOk && yOk;
    };
    // Normalize into an array of series
    const singleSeries = Array.isArray(data) ? [{ label: title || 'Series', color, data }] : [];
    const input = (spec.datasets && spec.datasets.length > 0) ? spec.datasets : singleSeries;
    return input.map((ds, idx) => {
      const values: { x: number; y: number }[] = Array.isArray(ds.data)
        ? (ds.data.length > 0 && isXY((ds.data as unknown[])[0])
            ? (ds.data as XY[]).map((d, i) => ({ x: i, y: d.y }))
            : (ds.data as number[]).map((y, i) => ({ x: i, y }))
          )
        : [];
      return {
        label: ds.label || `Series ${idx + 1}`,
        color: ds.color || undefined,
        values,
      };
    });
  }, [data, spec.datasets, title, color]);

  const layout = useMemo(() => {
    const allValues = seriesList.flatMap(s => s.values.map(v => v.y));
    const rawMax = allValues.length ? Math.max(1, ...allValues) : 1;
    const rawMin = allValues.length ? Math.min(0, ...allValues) : 0;
    const maxY = typeof yMax === 'number' ? yMax : rawMax;
    const minY = typeof yMin === 'number' ? yMin : rawMin;
    const pad = 32;
    const innerW = Math.max(1, width - pad * 2);
    const innerH = Math.max(1, height - pad * 2);
    const count = seriesList.reduce((acc, s) => Math.max(acc, s.values.length), 0);
    // Precompute x centers for categories (used for x labels and line points)
    const xCenters: number[] = Array.from({ length: count }, (_, i) => pad + (count > 1 ? (i / (count - 1)) * innerW : innerW / 2));
    return { minY, maxY, pad, innerW, innerH, count, xCenters };
  }, [seriesList, width, height, yMin, yMax]);

  const ticks = useMemo(() => {
    const count = Math.max(2, Math.min(10, Math.round(yTickCount)));
    const values: number[] = [];
    const range = layout.maxY - layout.minY || 1;
    for (let i = 0; i <= count; i++) {
      values.push(layout.minY + (range * i) / count);
    }
    return values;
  }, [layout.maxY, layout.minY, yTickCount]);

  const formatTick = (v: number): string => {
    const range = Math.abs(layout.maxY - layout.minY);
    if (range >= 10) return Math.round(v).toString();
    if (range >= 1) return v.toFixed(1).replace(/\.0$/, '');
    return v.toFixed(2).replace(/0+$/,'').replace(/\.$/,'');
  };

  if (!Array.isArray(data) || (Array.isArray(data) && data.length === 0)) {
    return (
      <div className={`text-xs text-muted-foreground ${className || ""}`}>No chart data</div>
    );
  }

  const isPie = type === 'pie';

  return (
    <div className={className}>
      {title && (
        <div className="text-sm font-medium mb-2 text-foreground">{title}</div>
      )}
      <svg width={width} height={height} role="img" aria-label={title || "Chart"}>
        {/* Background */}
        <rect x={0} y={0} width={width} height={height} fill="var(--background, #0b0b0b00)" />
        {/* Axes (skip for pie) */}
        {!isPie && (
          <>
            <line x1={32} y1={height - 32} x2={width - 16} y2={height - 32} stroke="#94a3b8" strokeWidth={0.5} />
            <line x1={32} y1={16} x2={32} y2={height - 32} stroke="#94a3b8" strokeWidth={0.5} />
          </>
        )}

        {/* Grid and Y ticks */}
        {!isPie && ticks.map((tv, i) => {
          const pad = 32;
          const innerH = height - pad * 2;
          const yNorm = (tv - layout.minY) / (layout.maxY - layout.minY || 1);
          const y = pad + innerH - yNorm * innerH;
          return (
            <g key={`yt-${i}`}>
              {grid && (
                <line x1={32} y1={y} x2={width - 16} y2={y} stroke="#cbd5e1" strokeWidth={0.5} opacity={0.3} />
              )}
              <text x={28} y={y + 3} fontSize="10" textAnchor="end" fill="#64748b">{formatTick(tv)}</text>
            </g>
          );
        })}

        {type === "line" && (
          <>
            {seriesList.map((s, si) => {
              const seriesColor = s.color || ["#4f46e5","#16a34a","#dc2626","#f59e0b","#0ea5e9","#a855f7"][si % 6];
              const pts = s.values.map((v, i) => {
                const x = layout.xCenters[i] ?? layout.xCenters[layout.xCenters.length - 1] ?? (layout.pad + layout.innerW / 2);
                const yNorm = (v.y - layout.minY) / (layout.maxY - layout.minY || 1);
                const y = layout.pad + layout.innerH - yNorm * layout.innerH;
                return { x, y };
              });
              return (
                <g key={`line-${si}`}>
                  <polyline fill="none" stroke={seriesColor} strokeWidth={2} points={pts.map(p => `${p.x},${p.y}`).join(' ')} />
                  {pts.map((p, i) => (
                    <g key={`pt-${si}-${i}`}>
                      <circle cx={p.x} cy={p.y} r={2.5} fill={seriesColor} />
                      <title>{`${String(labels[i] ?? i)}: ${s.values[i]?.y ?? ''}`}</title>
                      {dataLabels && (
                        <text x={p.x} y={p.y - 6} fontSize="10" textAnchor="middle" fill="#475569">{s.values[i]?.y ?? ''}</text>
                      )}
                    </g>
                  ))}
                </g>
              );
            })}
          </>
        )}

        {type === "bar" && (
          <>
            {(() => {
              const groupCount = layout.count;
              const pad = 32;
              const innerW = width - pad * 2;
              const innerH = height - pad * 2;
              const groupSlotW = groupCount > 0 ? innerW / groupCount : innerW;
              const seriesN = Math.max(1, seriesList.length);
              const groupGap = 6;
              const barW = Math.max(4, (groupSlotW - groupGap) / seriesN);
              const base = pad + innerH;
              const palette = ["#4f46e5","#16a34a","#dc2626","#f59e0b","#0ea5e9","#a855f7"];
              const bars: React.ReactNode[] = [];
              for (let i = 0; i < groupCount; i++) {
                for (let s = 0; s < seriesList.length; s++) {
                  const series = seriesList[s];
                  const seriesColor = series.color || palette[s % palette.length];
                  const val = series.values[i]?.y ?? 0;
                  const yNorm = (val - layout.minY) / (layout.maxY - layout.minY || 1);
                  const y = pad + innerH - yNorm * innerH;
                  const x = pad + i * groupSlotW + groupGap / 2 + s * barW;
                  bars.push(
                    <g key={`bar-${i}-${s}`}>
                      <rect x={x} y={y} width={barW} height={Math.max(1, base - y)} fill={seriesColor} opacity={0.9}>
                        <title>{`${String(labels[i] ?? i)}${series.label ? ` (${series.label})` : ''}: ${val}`}</title>
                      </rect>
                      {dataLabels && (
                        <text x={x + barW / 2} y={y - 4} fontSize="10" textAnchor="middle" fill="#475569">{val}</text>
                      )}
                    </g>
                  );
                }
              }
              return bars;
            })()}
          </>
        )}

        {type === 'pie' && (() => {
          // Compute pie slices from either single series data or first dataset
          const palette = spec.colors && spec.colors.length > 0 ? spec.colors : ["#6366f1","#22c55e","#ef4444","#f59e0b","#0ea5e9","#a855f7","#10b981","#f97316"];
          let values: number[] = [];
          if (spec.datasets && spec.datasets.length > 0) {
            const ds0 = spec.datasets[0];
            if (Array.isArray(ds0.data)) {
              values = (ds0.data as Array<number | { x: number | string; y: number }>).map(v => typeof v === 'number' ? v : (typeof v === 'object' && v && typeof (v as { y?: unknown }).y === 'number' ? (v as { y: number }).y : 0));
            }
          } else if (Array.isArray(spec.data)) {
            values = (spec.data as Array<number | { x: number | string; y: number }>).map(v => typeof v === 'number' ? v : (typeof v === 'object' && v && typeof (v as { y?: unknown }).y === 'number' ? (v as { y: number }).y : 0));
          }
          const sum = values.reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0) || 1;
          const cx = width / 2; const cy = height / 2;
          const outerR = Math.min(width, height) * 0.38;
          const innerR = Math.max(0, Math.min(outerR * 0.9, spec.innerRadius ?? 0));
          let angleStart = -Math.PI / 2; // start at top
          const slices: React.ReactNode[] = [];
          for (let i = 0; i < values.length; i++) {
            const frac = (values[i] || 0) / sum;
            const angleEnd = angleStart + frac * Math.PI * 2;
            // Arc path for donut/pie
            const largeArc = (angleEnd - angleStart) > Math.PI ? 1 : 0;
            const x0 = cx + outerR * Math.cos(angleStart);
            const y0 = cy + outerR * Math.sin(angleStart);
            const x1 = cx + outerR * Math.cos(angleEnd);
            const y1 = cy + outerR * Math.sin(angleEnd);
            const ix0 = cx + innerR * Math.cos(angleEnd);
            const iy0 = cy + innerR * Math.sin(angleEnd);
            const ix1 = cx + innerR * Math.cos(angleStart);
            const iy1 = cy + innerR * Math.sin(angleStart);
            const path = innerR > 0
              ? `M ${x0} ${y0} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x1} ${y1} L ${ix0} ${iy0} A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix1} ${iy1} Z`
              : `M ${cx} ${cy} L ${x0} ${y0} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x1} ${y1} Z`;
            const col = palette[i % palette.length];
            const label = String(labels[i] ?? i);
            slices.push(
              <g key={`slice-${i}`}>
                <path d={path} fill={col} opacity={0.95}>
                  <title>{`${label}: ${values[i] ?? 0}`}</title>
                </path>
              </g>
            );
            angleStart = angleEnd;
          }
          return <>{slices}</>;
        })()}

        {/* X labels */}
        {!isPie && labels.length > 0 && (
          <g>
            {Array.from({ length: layout.count }, (_, i) => (
              <text
                key={`x-${i}`}
                x={type === 'bar' ? (layout.pad + (i + 0.5) * (layout.innerW / Math.max(1, layout.count))) : layout.xCenters[i]}
                y={height - 16}
                fontSize="10"
                textAnchor="middle"
                fill="#64748b"
              >
                {String(labels[i] ?? i)}
              </text>
            ))}
          </g>
        )}

        {/* Axis labels */}
        {xAxisLabel && (
          <text x={width / 2} y={height - 4} fontSize="11" textAnchor="middle" fill="#475569">
            {xAxisLabel}
          </text>
        )}
        {yAxisLabel && (
          <text x={10} y={height / 2} fontSize="11" textAnchor="middle" fill="#475569" transform={`rotate(-90 10 ${height / 2})`}>
            {yAxisLabel}
          </text>
        )}

        {/* Legend (single series) */}
        {legend && (
          <g>
            {(type !== 'pie'
              ? seriesList.map((s) => ({ label: s.label, color: s.color }))
              : (labels || []).map((lab, idx) => ({ label: String(lab), color: (spec.colors && spec.colors[idx]) || ["#6366f1","#22c55e","#ef4444","#f59e0b","#0ea5e9","#a855f7"][idx % 6] }))
              ).map((entry, i) => {
              const seriesColor = entry.color || "#4f46e5";
              const y = 18 + i * 14;
              return (
                <g key={`leg-${i}`}>
                  <rect x={width - 140} y={y} width={10} height={10} fill={seriesColor} />
                  <text x={width - 124} y={y + 9} fontSize="11" fill="#334155">{entry.label}</text>
                </g>
              );
            })
            }
          </g>
        )}
      </svg>
    </div>
  );
};

export default InlineChart;


