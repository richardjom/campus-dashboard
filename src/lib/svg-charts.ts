// Lightweight inline SVG chart builders for the printable report.
// No runtime deps — output strings can be embedded directly in HTML.

export type LineSeries = {
  name: string;
  color: string;
  values: number[];
  dashed?: boolean;
};

const palette = ["#2563eb", "#0f172a", "#14b8a6", "#f97316", "#7c3aed", "#dc2626", "#0891b2", "#84cc16", "#ec4899", "#6366f1"];

export function getPalette(index: number): string {
  return palette[index % palette.length];
}

/**
 * Multi-series line chart with x-axis labels.
 */
export function buildLineChartSvg(
  labels: string[],
  series: LineSeries[],
  options: { width?: number; height?: number; showLegend?: boolean } = {},
): string {
  const width = options.width ?? 720;
  const height = options.height ?? 260;
  const showLegend = options.showLegend ?? true;
  const padding = { top: 16, right: 16, bottom: 36, left: 48 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const allValues = series.flatMap((s) => s.values).filter((v) => v > 0);
  if (allValues.length === 0 || labels.length === 0) {
    return `<div style="height:${height}px;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:13px;border:1px dashed #e5e7eb;border-radius:12px;">No data</div>`;
  }
  const maxValue = Math.max(...allValues);
  const minValue = 0;

  const xStep = labels.length > 1 ? innerW / (labels.length - 1) : 0;
  const yScale = (value: number) => {
    if (maxValue === minValue) return innerH / 2;
    return innerH - ((value - minValue) / (maxValue - minValue)) * innerH;
  };

  // Y axis gridlines (5 lines)
  const gridSteps = 5;
  const gridLines = Array.from({ length: gridSteps + 1 }, (_, i) => {
    const value = (maxValue / gridSteps) * i;
    const y = padding.top + yScale(value);
    return { y, value: Math.round(value) };
  });

  const polylines = series
    .map((s) => {
      const pts = s.values
        .map((v, i) => {
          if (v <= 0) return null;
          const x = padding.left + i * xStep;
          const y = padding.top + yScale(v);
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .filter((p): p is string => p !== null)
        .join(" ");
      const dash = s.dashed ? `stroke-dasharray="6,4"` : "";
      return `<polyline fill="none" stroke="${s.color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" ${dash} points="${pts}" />`;
    })
    .join("");

  const xLabels = labels
    .map((label, i) => {
      // Skip some labels if there are too many
      if (labels.length > 13 && i % 2 !== 0 && i !== labels.length - 1) return "";
      const x = padding.left + i * xStep;
      return `<text x="${x.toFixed(1)}" y="${height - 12}" text-anchor="middle" font-size="10" fill="#64748b">${escapeXml(label)}</text>`;
    })
    .join("");

  const gridLinesSvg = gridLines
    .map(
      (g) =>
        `<line x1="${padding.left}" y1="${g.y.toFixed(1)}" x2="${padding.left + innerW}" y2="${g.y.toFixed(1)}" stroke="#e5e7eb" stroke-width="1" />` +
        `<text x="${padding.left - 6}" y="${(g.y + 3).toFixed(1)}" text-anchor="end" font-size="10" fill="#94a3b8">${formatAxisValue(g.value)}</text>`,
    )
    .join("");

  const legendY = height + 12;
  const legendSvg = showLegend
    ? `<div style="display:flex;flex-wrap:wrap;gap:14px;margin-top:8px;font-size:12px;color:#475569;">
        ${series.map((s) => `<span style="display:inline-flex;align-items:center;gap:6px;"><span style="width:10px;height:2px;background:${s.color};${s.dashed ? "border-top:1px dashed " + s.color + ";background:none;height:1px;" : ""}"></span>${escapeXml(s.name)}</span>`).join("")}
      </div>`
    : "";

  void legendY;

  return `<div style="width:100%;">
    <svg width="100%" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
      ${gridLinesSvg}
      ${polylines}
      ${xLabels}
    </svg>
    ${legendSvg}
  </div>`;
}

/**
 * Horizontal grouped bar chart — great for period-vs-period campus comparison.
 */
export function buildHorizontalBarChartSvg(
  rows: Array<{ label: string; values: Array<{ name: string; value: number; color: string }> }>,
  options: { width?: number; height?: number; valueFormatter?: (v: number) => string } = {},
): string {
  const width = options.width ?? 720;
  const fmt = options.valueFormatter ?? ((v) => v.toLocaleString());
  const labelWidth = 120;
  const valueWidth = 70;
  const barAreaW = width - labelWidth - valueWidth - 20;
  const groupHeight = 28;
  const groupGap = 12;
  const groups = rows.length;

  const allValues = rows.flatMap((r) => r.values.map((v) => v.value));
  const maxValue = Math.max(...allValues, 1);

  const numSeriesPerGroup = rows[0]?.values.length ?? 1;
  const barH = (groupHeight - 4) / numSeriesPerGroup;

  const height = groups * (groupHeight + groupGap) + 8;

  const groupsSvg = rows
    .map((row, gi) => {
      const groupY = gi * (groupHeight + groupGap);
      const labelSvg = `<text x="${labelWidth - 8}" y="${groupY + groupHeight / 2 + 4}" text-anchor="end" font-size="12" font-weight="600" fill="#0f172a">${escapeXml(row.label)}</text>`;
      const bars = row.values
        .map((entry, vi) => {
          const w = (entry.value / maxValue) * barAreaW;
          const y = groupY + 2 + vi * barH;
          return (
            `<rect x="${labelWidth}" y="${y.toFixed(1)}" width="${Math.max(w, 1).toFixed(1)}" height="${(barH - 1).toFixed(1)}" rx="3" fill="${entry.color}" />` +
            `<text x="${(labelWidth + w + 6).toFixed(1)}" y="${(y + barH / 2 + 3.5).toFixed(1)}" font-size="10" fill="#475569">${escapeXml(fmt(entry.value))}</text>`
          );
        })
        .join("");
      return labelSvg + bars;
    })
    .join("");

  return `<svg width="100%" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">${groupsSvg}</svg>`;
}

/**
 * Donut chart for distribution display.
 */
export function buildDonutSvg(
  segments: Array<{ name: string; value: number; color: string }>,
  options: { size?: number; innerRadius?: number } = {},
): string {
  const size = options.size ?? 220;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 8;
  const innerR = options.innerRadius ?? r * 0.6;

  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) {
    return `<div style="height:${size}px;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:13px;">No data</div>`;
  }

  let cumulative = 0;
  const paths = segments
    .map((seg) => {
      const startAngle = (cumulative / total) * Math.PI * 2 - Math.PI / 2;
      cumulative += seg.value;
      const endAngle = (cumulative / total) * Math.PI * 2 - Math.PI / 2;
      return arcPath(cx, cy, r, innerR, startAngle, endAngle, seg.color);
    })
    .join("");

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">${paths}<text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="11" fill="#94a3b8">Total</text><text x="${cx}" y="${cy + 12}" text-anchor="middle" font-size="16" font-weight="700" fill="#0f172a">${total.toLocaleString()}</text></svg>`;
}

function arcPath(cx: number, cy: number, rOuter: number, rInner: number, start: number, end: number, color: string): string {
  const largeArc = end - start > Math.PI ? 1 : 0;
  const x1 = cx + rOuter * Math.cos(start);
  const y1 = cy + rOuter * Math.sin(start);
  const x2 = cx + rOuter * Math.cos(end);
  const y2 = cy + rOuter * Math.sin(end);
  const x3 = cx + rInner * Math.cos(end);
  const y3 = cy + rInner * Math.sin(end);
  const x4 = cx + rInner * Math.cos(start);
  const y4 = cy + rInner * Math.sin(start);
  const d = `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} L ${x3.toFixed(2)} ${y3.toFixed(2)} A ${rInner} ${rInner} 0 ${largeArc} 0 ${x4.toFixed(2)} ${y4.toFixed(2)} Z`;
  return `<path d="${d}" fill="${color}" />`;
}

/**
 * Vertical bar chart — good for "worst weeks" or per-period totals.
 */
export function buildVerticalBarChartSvg(
  rows: Array<{ label: string; value: number; color?: string }>,
  options: { width?: number; height?: number; valueFormatter?: (v: number) => string } = {},
): string {
  const width = options.width ?? 720;
  const height = options.height ?? 220;
  const fmt = options.valueFormatter ?? ((v) => v.toLocaleString());
  const padding = { top: 16, right: 16, bottom: 40, left: 48 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  if (rows.length === 0) {
    return `<div style="height:${height}px;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:13px;border:1px dashed #e5e7eb;border-radius:12px;">No data</div>`;
  }

  const maxValue = Math.max(...rows.map((r) => r.value), 1);
  const barW = innerW / rows.length;
  const barPadding = barW * 0.2;

  const gridSteps = 4;
  const gridLines = Array.from({ length: gridSteps + 1 }, (_, i) => {
    const value = (maxValue / gridSteps) * i;
    const y = padding.top + innerH - (value / maxValue) * innerH;
    return { y, value: Math.round(value) };
  });

  const gridLinesSvg = gridLines
    .map(
      (g) =>
        `<line x1="${padding.left}" y1="${g.y.toFixed(1)}" x2="${padding.left + innerW}" y2="${g.y.toFixed(1)}" stroke="#e5e7eb" stroke-width="1" />` +
        `<text x="${padding.left - 6}" y="${(g.y + 3).toFixed(1)}" text-anchor="end" font-size="10" fill="#94a3b8">${formatAxisValue(g.value)}</text>`,
    )
    .join("");

  const bars = rows
    .map((row, i) => {
      const x = padding.left + i * barW + barPadding / 2;
      const w = barW - barPadding;
      const h = (row.value / maxValue) * innerH;
      const y = padding.top + innerH - h;
      const color = row.color ?? "#2563eb";
      return (
        `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${Math.max(h, 1).toFixed(1)}" rx="3" fill="${color}" />` +
        `<text x="${(x + w / 2).toFixed(1)}" y="${(y - 4).toFixed(1)}" text-anchor="middle" font-size="10" fill="#475569">${escapeXml(fmt(row.value))}</text>` +
        `<text x="${(x + w / 2).toFixed(1)}" y="${(height - 14).toFixed(1)}" text-anchor="middle" font-size="10" fill="#64748b">${escapeXml(row.label)}</text>`
      );
    })
    .join("");

  return `<svg width="100%" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">${gridLinesSvg}${bars}</svg>`;
}

function formatAxisValue(value: number): string {
  if (value >= 1000) return `${Math.round(value / 100) / 10}k`;
  return value.toLocaleString();
}

function escapeXml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] ?? c));
}
