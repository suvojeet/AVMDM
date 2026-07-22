/**
 * Averio MDM — Generic Report Engine
 *
 * Provides a type-safe, extensible framework for generating PDF reports from
 * any structured data source.  Reports are rendered as styled HTML and sent
 * to the browser's native print dialog (which produces PDF via "Save as PDF").
 *
 * Extension points:
 *   1. Define a ReportDefinition<T> with your data type
 *   2. Provide a buildSections() function that maps T → ReportSection[]
 *   3. Call renderPdf(definition, data) — the engine handles layout and print
 *
 * Adding a new report:
 *   const myReport: ReportDefinition<MyData> = {
 *     id: "MY_REPORT",
 *     title: "My Report Title",
 *     subtitle: "Description",
 *     category: "Operations",
 *     buildSections: (data) => [...],
 *   };
 */

// ── Core types ────────────────────────────────────────────────────────────────

/** A single cell value — rendered as-is or stringified */
export type CellValue = string | number | boolean | null | undefined;

/** A table rendered inside a section body */
export interface ReportTable {
  kind: "table";
  headers: string[];
  rows: CellValue[][];
  caption?: string;
}

/** A key-value property list */
export interface ReportProperties {
  kind: "properties";
  rows: { label: string; value: CellValue; highlight?: boolean }[];
}

/** A plain paragraph block */
export interface ReportParagraph {
  kind: "paragraph";
  text: string;
}

/** A badge/tag list (e.g. strategies, flags) */
export interface ReportBadgeList {
  kind: "badge-list";
  label: string;
  items: string[];
  color?: "blue" | "green" | "amber" | "red" | "purple" | "gray";
}

/** A spacer / horizontal rule */
export interface ReportDivider {
  kind: "divider";
}

export type ReportBlock =
  | ReportTable
  | ReportProperties
  | ReportParagraph
  | ReportBadgeList
  | ReportDivider;

/** A titled section containing one or more blocks */
export interface ReportSection {
  title: string;
  subtitle?: string;
  badge?: string;
  badgeColor?: "blue" | "green" | "amber" | "red" | "purple" | "gray";
  blocks: ReportBlock[];
  /** Prevent a page break before this section */
  keepWithPrevious?: boolean;
}

/** Top-level report metadata + data-to-sections transformer */
export interface ReportDefinition<T = unknown> {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  description: string;
  /** Lucide icon name string — used in the catalog UI only */
  icon?: string;
  /** Build the section tree from fetched data */
  buildSections: (data: T) => ReportSection[];
}

/** Minimal report metadata shown in the catalog before data is fetched */
export interface ReportCatalogEntry {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  description: string;
  icon?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(val: CellValue): string {
  if (val === null || val === undefined || val === "") return "—";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  return String(val);
}

function escapHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const BADGE_COLORS: Record<string, string> = {
  blue:   "#3b82f6",
  green:  "#22c55e",
  amber:  "#f59e0b",
  red:    "#ef4444",
  purple: "#a855f7",
  gray:   "#6b7280",
};

const BADGE_BG: Record<string, string> = {
  blue:   "#1d4ed8",
  green:  "#15803d",
  amber:  "#92400e",
  red:    "#991b1b",
  purple: "#6b21a8",
  gray:   "#374151",
};

// ── Block renderers ───────────────────────────────────────────────────────────

function renderBlock(block: ReportBlock): string {
  switch (block.kind) {
    case "paragraph":
      return `<p class="block-para">${escapHtml(block.text)}</p>`;

    case "divider":
      return `<hr class="block-divider" />`;

    case "properties": {
      const rows = block.rows.map(r =>
        `<tr class="${r.highlight ? "prop-highlight" : ""}">
          <td class="prop-label">${escapHtml(r.label)}</td>
          <td class="prop-value">${escapHtml(fmt(r.value))}</td>
        </tr>`
      ).join("");
      return `<table class="prop-table"><tbody>${rows}</tbody></table>`;
    }

    case "table": {
      const thead = block.headers.map(h => `<th>${escapHtml(h)}</th>`).join("");
      const tbody = block.rows.map(row =>
        `<tr>${row.map(cell => `<td>${escapHtml(fmt(cell))}</td>`).join("")}</tr>`
      ).join("");
      const caption = block.caption
        ? `<caption class="table-caption">${escapHtml(block.caption)}</caption>`
        : "";
      return `<table class="data-table">${caption}<thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>`;
    }

    case "badge-list": {
      const color = block.color ?? "blue";
      const fg = BADGE_COLORS[color];
      const bg = BADGE_BG[color];
      const badges = block.items.map(item =>
        `<span class="badge" style="color:${fg};background:${bg}22;border:1px solid ${fg}44">${escapHtml(item)}</span>`
      ).join(" ");
      return `<div class="badge-row"><span class="badge-label">${escapHtml(block.label)}:</span>${badges}</div>`;
    }
  }
}

function renderSection(section: ReportSection, index: number): string {
  const badge = section.badge
    ? (() => {
        const color = section.badgeColor ?? "blue";
        const fg = BADGE_COLORS[color];
        const bg = BADGE_BG[color];
        return `<span class="sec-badge" style="color:${fg};background:${bg}22;border:1px solid ${fg}44">${escapHtml(section.badge)}</span>`;
      })()
    : "";

  const subtitle = section.subtitle
    ? `<p class="sec-subtitle">${escapHtml(section.subtitle)}</p>`
    : "";

  const blocks = section.blocks.map(renderBlock).join("\n");
  const breakClass = section.keepWithPrevious ? "" : (index > 0 ? " sec-break" : "");

  return `
    <section class="report-section${breakClass}">
      <div class="sec-header">
        <h2 class="sec-title">${escapHtml(section.title)} ${badge}</h2>
        ${subtitle}
      </div>
      <div class="sec-body">${blocks}</div>
    </section>`;
}

// ── CSS ───────────────────────────────────────────────────────────────────────

function buildStyles(accentHex = "#3b82f6"): string {
  return `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; font-size: 11pt; color: #1e293b; background: #fff; }

    /* ── Cover ── */
    .cover { padding: 56pt 56pt 40pt; border-bottom: 3pt solid ${accentHex}; margin-bottom: 32pt; }
    .cover-watermark { font-size: 7pt; font-weight: 700; letter-spacing: 6pt; color: #94a3b8; text-transform: uppercase; margin-bottom: 16pt; }
    .cover-title { font-size: 26pt; font-weight: 800; color: #0f172a; line-height: 1.15; }
    .cover-subtitle { font-size: 12pt; color: #64748b; margin-top: 6pt; }
    .cover-meta { margin-top: 28pt; display: flex; gap: 48pt; }
    .cover-meta-item label { display: block; font-size: 7pt; font-weight: 700; letter-spacing: 2pt; color: #94a3b8; text-transform: uppercase; margin-bottom: 3pt; }
    .cover-meta-item span { font-size: 10pt; color: #334155; font-weight: 600; }
    .cover-accent { display: inline-block; width: 32pt; height: 3pt; background: ${accentHex}; border-radius: 2pt; margin-bottom: 14pt; }

    /* ── Sections ── */
    .report-section { padding: 20pt 56pt; }
    .sec-break { page-break-before: auto; break-before: auto; margin-top: 4pt; }
    .sec-header { margin-bottom: 10pt; padding-bottom: 6pt; border-bottom: 1pt solid #e2e8f0; display: flex; flex-direction: column; gap: 3pt; }
    .sec-title { font-size: 13pt; font-weight: 700; color: #0f172a; display: flex; align-items: center; gap: 8pt; }
    .sec-subtitle { font-size: 9pt; color: #64748b; }
    .sec-badge { font-size: 7pt; font-weight: 700; padding: 2pt 6pt; border-radius: 10pt; letter-spacing: 0.5pt; text-transform: uppercase; }
    .sec-body { padding-top: 2pt; }

    /* ── Blocks ── */
    .block-para { font-size: 10pt; color: #475569; line-height: 1.55; margin-bottom: 8pt; }
    .block-divider { border: none; border-top: 1pt solid #e2e8f0; margin: 10pt 0; }

    /* ── Properties table ── */
    .prop-table { width: 100%; border-collapse: collapse; margin-bottom: 10pt; font-size: 10pt; }
    .prop-table td { padding: 5pt 8pt; vertical-align: top; }
    .prop-label { color: #64748b; font-weight: 600; width: 38%; white-space: nowrap; }
    .prop-value { color: #1e293b; }
    .prop-table tr:nth-child(even) { background: #f8fafc; }
    .prop-highlight td { background: #eff6ff !important; color: #1d4ed8; font-weight: 700; }

    /* ── Data table ── */
    .data-table { width: 100%; border-collapse: collapse; margin-bottom: 10pt; font-size: 9.5pt; }
    .data-table caption.table-caption { font-size: 8.5pt; color: #64748b; text-align: left; margin-bottom: 4pt; font-style: italic; }
    .data-table th { background: ${accentHex}; color: #fff; font-weight: 700; padding: 5pt 8pt; text-align: left; font-size: 9pt; letter-spacing: 0.3pt; }
    .data-table td { padding: 5pt 8pt; border-bottom: 1pt solid #e2e8f0; color: #334155; vertical-align: top; }
    .data-table tr:hover td { background: #f8fafc; }

    /* ── Badge list ── */
    .badge-row { display: flex; flex-wrap: wrap; align-items: center; gap: 5pt; margin-bottom: 8pt; }
    .badge-label { font-size: 9pt; font-weight: 700; color: #64748b; min-width: 80pt; }
    .badge { font-size: 8pt; font-weight: 700; padding: 2pt 7pt; border-radius: 8pt; letter-spacing: 0.3pt; }

    /* ── Footer ── */
    .report-footer { margin-top: 32pt; padding: 12pt 56pt; border-top: 1pt solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; font-size: 8pt; color: #94a3b8; }

    /* ── Print ── */
    @media print {
      @page { margin: 0.4in; size: A4 portrait; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .data-table th, .prop-highlight td { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  `;
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface RenderOptions {
  /** Hex accent colour for header stripe and table headings */
  accentColor?: string;
  /** Organisation / tenant name shown on the cover */
  orgName?: string;
  /** Optional string appended below the report title */
  coverNote?: string;
}

/**
 * Render a report definition + hydrated data to a printable HTML document
 * and open the browser print dialog.  Users choose "Save as PDF" or print.
 */
export function renderPdf<T>(
  definition: ReportDefinition<T>,
  data: T,
  options: RenderOptions = {}
): void {
  const { accentColor = "#3b82f6", orgName = "Averio MDM", coverNote } = options;

  const sections = definition.buildSections(data);
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });

  const coverHtml = `
    <div class="cover">
      <div class="cover-watermark">${escapHtml(orgName)} · Confidential</div>
      <div class="cover-accent"></div>
      <h1 class="cover-title">${escapHtml(definition.title)}</h1>
      <p class="cover-subtitle">${escapHtml(definition.subtitle)}</p>
      ${coverNote ? `<p class="cover-subtitle" style="margin-top:4pt;color:#94a3b8">${escapHtml(coverNote)}</p>` : ""}
      <div class="cover-meta">
        <div class="cover-meta-item"><label>Generated</label><span>${escapHtml(dateStr)} at ${escapHtml(timeStr)}</span></div>
        <div class="cover-meta-item"><label>Category</label><span>${escapHtml(definition.category)}</span></div>
        <div class="cover-meta-item"><label>Report ID</label><span>${escapHtml(definition.id)}</span></div>
      </div>
    </div>`;

  const sectionsHtml = sections.map((s, i) => renderSection(s, i)).join("\n");

  const footerHtml = `
    <div class="report-footer">
      <span>${escapHtml(orgName)} · ${escapHtml(definition.title)}</span>
      <span>Generated ${escapHtml(dateStr)} · CONFIDENTIAL</span>
    </div>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escapHtml(definition.title)} — ${escapHtml(orgName)}</title>
  <style>${buildStyles(accentColor)}</style>
</head>
<body>
  ${coverHtml}
  ${sectionsHtml}
  ${footerHtml}
  <script>window.onload = function() { window.print(); }<\/script>
</body>
</html>`;

  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) {
    // Popup blocked — fallback: inject into a hidden iframe
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;border:none";
    document.body.appendChild(iframe);
    iframe.contentDocument?.open();
    iframe.contentDocument?.write(html);
    iframe.contentDocument?.close();
    setTimeout(() => {
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 2000);
    }, 500);
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}

/**
 * Extract a ReportCatalogEntry (metadata only, no generic type) from a definition.
 * Useful for building a catalog UI without needing the data type parameter.
 */
export function catalogEntry<T>(def: ReportDefinition<T>): ReportCatalogEntry {
  return {
    id: def.id,
    title: def.title,
    subtitle: def.subtitle,
    category: def.category,
    description: def.description,
    icon: def.icon,
  };
}
