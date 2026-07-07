import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import * as XLSX from "xlsx";
import { calculateFeasibility, calculatePackingListTotals } from "./calculations";
import { FeasibilityStudy, PackingList, Shipment } from "./storage";

// ─── Shared helpers ───────────────────────────────────────────────────────────

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function todayStr() {
  return new Date().toLocaleDateString("en-GB");
}

function fmt(num: number, decimals = 2): string {
  return num.toLocaleString("en-US", {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  });
}

function safeSheetName(raw: string, taken: string[]): string {
  const clean = raw.replace(/[\/\\?*\[\]:]/g, "").trim().slice(0, 28) || "Sheet";
  let name = clean;
  let i = 2;
  while (taken.includes(name)) name = `${clean.slice(0, 25)} (${i++})`;
  return name;
}

// ─── HTML → Canvas → PDF ─────────────────────────────────────────────────────
//
// We render an off-screen HTML element with the browser's own Arabic text
// engine (correct shaping + RTL), capture it to canvas with html2canvas,
// then embed the canvas image into jsPDF. This avoids all font-embedding
// and reshaping complexity.

const FONT = "'Cairo','Tajawal','Noto Sans Arabic','Segoe UI',Arial,sans-serif";

/** Create an off-screen container appended to the body. */
function mkContainer(widthPx: number, bgColor = "#ffffff"): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText = [
    "position:fixed",
    "left:-9999px",
    "top:0",
    `width:${widthPx}px`,
    `background:${bgColor}`,
    `font-family:${FONT}`,
    "direction:rtl",
    "color:#1a1a1a",
    "box-sizing:border-box",
    "line-height:1.5",
  ].join(";");
  document.body.appendChild(el);
  return el;
}

/** Render a list of DOM elements → one jsPDF page each, then save. */
async function pagesToPDF(
  pages: HTMLDivElement[],
  filename: string,
  orientation: "portrait" | "landscape" = "portrait"
): Promise<void> {
  const pdfW = orientation === "landscape" ? 297 : 210;
  const pdfH = orientation === "landscape" ? 210 : 297;
  const doc = new jsPDF({ orientation, unit: "mm", format: "a4" });

  for (let i = 0; i < pages.length; i++) {
    const el = pages[i];
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      allowTaint: true,
    });
    document.body.removeChild(el);

    const imgData = canvas.toDataURL("image/jpeg", 0.92);
    // Scale to fill the page width; if taller than page, shrink to fit height
    const ratio = canvas.height / canvas.width;
    let imgW = pdfW;
    let imgH = pdfW * ratio;
    if (imgH > pdfH) {
      imgH = pdfH;
      imgW = pdfH / ratio;
    }
    const xOff = (pdfW - imgW) / 2;
    const yOff = (pdfH - imgH) / 2;

    if (i > 0) doc.addPage();
    doc.addImage(imgData, "JPEG", xOff, yOff, imgW, imgH);
  }

  doc.save(filename);
}

// ─── CSS string helpers ───────────────────────────────────────────────────────

const hdr = (bg: string) =>
  `background:${bg};color:#fff;padding:18px 24px;border-radius:8px 8px 0 0;margin-bottom:0`;

const tblWrap = "width:100%;border-collapse:collapse;font-size:12px";
const th = (bg = "#0f172a") =>
  `background:${bg};color:#fff;padding:8px 12px;text-align:center;border:1px solid ${bg}`;
const td0 = "padding:8px 12px;border:1px solid #e2e8f0;vertical-align:top";
const tdR = "padding:8px 12px;border:1px solid #e2e8f0;text-align:center;vertical-align:top";
const tdBold = `${td0};font-weight:700`;
const altRow = "#f8fafc";
const foot = `text-align:center;color:#94a3b8;font-size:10px;padding:12px;margin-top:8px`;

function rowHtml(label: string, value: string, bg = "#fff"): string {
  return `<tr style="background:${bg}">
    <td style="${tdBold}">${label}</td>
    <td style="${tdR}">${value}</td>
  </tr>`;
}

function pageFooter(): string {
  return `<div style="${foot}">China Import Tracker — مستورد الصين — ${todayStr()}</div>`;
}

// ─── PDF – Feasibility Study ──────────────────────────────────────────────────

export async function exportStudyPDF(study: FeasibilityStudy) {
  const calc = calculateFeasibility(study);

  const el = mkContainer(794);
  el.innerHTML = `
<div style="padding:0">
  <div style="${hdr("#0f172a")}">
    <div style="font-size:18px;font-weight:700">تقرير دراسة الجدوى</div>
    <div style="font-size:12px;margin-top:4px;opacity:.8">China Import Tracker — مستورد الصين</div>
  </div>

  <div style="padding:20px 24px 0">
    <div style="font-size:20px;font-weight:700;color:#0f172a;margin-bottom:4px">${study.productName}</div>
    <div style="color:#64748b;font-size:12px">التاريخ: ${todayStr()} | العملة: ${study.currency} | الكمية: ${study.quantity.toLocaleString("en-US")} وحدة</div>
  </div>

  <div style="padding:16px 24px 0">
    <div style="font-weight:700;font-size:14px;color:#0f172a;margin-bottom:8px">📋 بيانات المدخلات</div>
    <table style="${tblWrap}">
      <thead><tr>
        <th style="${th()}">البند</th>
        <th style="${th()}">القيمة</th>
      </tr></thead>
      <tbody>
        ${rowHtml("سعر المصنع للوحدة", `${fmt(study.factoryPrice)} ${study.currency}`)}
        ${rowHtml("الكمية المطلوبة", `${study.quantity.toLocaleString("en-US")} وحدة`, altRow)}
        ${rowHtml("قطع بالكرتونة", `${study.unitsPerCarton}`)}
        ${rowHtml("أبعاد الكرتونة (سم)", `${study.cartonLength} × ${study.cartonWidth} × ${study.cartonHeight}`, altRow)}
        ${rowHtml("الوزن الإجمالي للكرتونة (كج)", `${study.grossWeight ?? "—"}`)}
        ${rowHtml("الشحن الداخلي في الصين (يوان)", `${fmt(study.domesticShippingRMB)}`, altRow)}
        ${rowHtml("تكلفة الشحن البحري / الجوي (ر.س)", `${fmt(study.freightCostSAR)}`)}
        ${rowHtml("الرسوم الجمركية", `${study.customDutyPct}%`, altRow)}
        ${rowHtml("ضريبة القيمة المضافة", `${study.vatPct}%`)}
        ${rowHtml("أجور التخليص الجمركي (ر.س)", `${fmt(study.clearanceFeeSAR)}`, altRow)}
        ${rowHtml("الشحن الداخلي للمستودع (ر.س)", `${fmt(study.localLogisticsSAR)}`)}
        ${rowHtml("رسوم الشهادات / سابر (ر.س)", `${fmt(study.certificationFeeSAR)}`, altRow)}
        ${rowHtml("سعر البيع المستهدف / وحدة (ر.س)", `${fmt(study.targetSellingPrice)}`)}
      </tbody>
    </table>
  </div>

  <div style="padding:16px 24px 0">
    <div style="font-weight:700;font-size:14px;color:#0f172a;margin-bottom:8px">📊 نتائج دراسة الجدوى</div>
    <table style="${tblWrap}">
      <thead><tr>
        <th style="${th("#1e3a5f")}">المؤشر</th>
        <th style="${th("#1e3a5f")}">القيمة</th>
      </tr></thead>
      <tbody>
        ${rowHtml("إجمالي التكلفة الواصلة (ر.س)", fmt(calc.totalLandedCostSAR))}
        ${rowHtml("التكلفة للوحدة واصل (ر.س)", fmt(calc.costPerUnitLandedSAR), altRow)}
        ${rowHtml("السعر الأدنى المقترح للبيع (ر.س)", fmt(calc.recommendedMinPriceSAR))}
        ${rowHtml("الربح الصافي الإجمالي (ر.س)", `<span style="color:${calc.netProfitSAR >= 0 ? "#16a34a" : "#dc2626"};font-weight:700">${fmt(calc.netProfitSAR)}</span>`, altRow)}
        ${rowHtml("الربح الصافي للوحدة (ر.س)", `<span style="color:${calc.netProfitPerUnitSAR >= 0 ? "#16a34a" : "#dc2626"};font-weight:700">${fmt(calc.netProfitPerUnitSAR)}</span>`)}
        ${rowHtml("هامش الربح الصافي", `${fmt(calc.netProfitMarginPct)}%`, altRow)}
        ${rowHtml("العائد على الاستثمار (ROI)", `${fmt(calc.roiPct)}%`)}
        ${rowHtml("إجمالي الحجم (CBM)", fmt(calc.totalCBM, 3), altRow)}
        ${rowHtml("إجمالي عدد الكراتين", `${calc.totalCartons}`)}
        ${rowHtml("نسبة المخاطرة (من 10)", `<span style="color:${calc.riskScore <= 3 ? "#16a34a" : calc.riskScore <= 6 ? "#d97706" : "#dc2626"};font-weight:700">${calc.riskScore} / 10</span>`, altRow)}
      </tbody>
    </table>
  </div>

  <div style="padding:16px 24px 20px">
    ${pageFooter()}
  </div>
</div>`;

  await pagesToPDF([el], `Study_${study.productName}_${todayStr().replace(/\//g, "-")}.pdf`);
}

// ─── Excel – Feasibility Study ────────────────────────────────────────────────

export function exportStudyExcel(study: FeasibilityStudy) {
  const calc = calculateFeasibility(study);
  const rows: any[][] = [
    ["بيانات المدخلات", ""],
    ["اسم المنتج", study.productName],
    ["العملة", study.currency],
    ["سعر المصنع لكل وحدة", study.factoryPrice],
    ["الكمية المطلوبة", study.quantity],
    ["قطع بالكرتونة", study.unitsPerCarton],
    ["طول الكرتونة (سم)", study.cartonLength],
    ["عرض الكرتونة (سم)", study.cartonWidth],
    ["ارتفاع الكرتونة (سم)", study.cartonHeight],
    ["الشحن الداخلي في الصين (يوان)", study.domesticShippingRMB],
    ["تكلفة الشحن البحري/الجوي (ر.س)", study.freightCostSAR],
    ["الرسوم الجمركية %", study.customDutyPct],
    ["ضريبة القيمة المضافة %", study.vatPct],
    ["أجور التخليص الجمركي (ر.س)", study.clearanceFeeSAR],
    ["الشحن الداخلي للمستودع (ر.س)", study.localLogisticsSAR],
    ["رسوم الشهادات سابر/SFDA (ر.س)", study.certificationFeeSAR],
    ["سعر البيع المستهدف لكل وحدة (ر.س)", study.targetSellingPrice],
    ["", ""],
    ["نتائج دراسة الجدوى", ""],
    ["إجمالي التكلفة واصل المستودع (ر.س)", +calc.totalLandedCostSAR.toFixed(2)],
    ["التكلفة لكل وحدة واصل (ر.س)", +calc.costPerUnitLandedSAR.toFixed(2)],
    ["السعر الأدنى المقترح للبيع (ر.س)", +calc.recommendedMinPriceSAR.toFixed(2)],
    ["الربح الإجمالي (ر.س)", +calc.netProfitSAR.toFixed(2)],
    ["الربح لكل وحدة (ر.س)", +calc.netProfitPerUnitSAR.toFixed(2)],
    ["هامش الربح الصافي %", +calc.netProfitMarginPct.toFixed(2)],
    ["العائد على الاستثمار ROI %", +calc.roiPct.toFixed(2)],
    ["إجمالي الحجم CBM", +calc.totalCBM.toFixed(3)],
    ["إجمالي عدد الكراتين", calc.totalCartons],
    ["نسبة المخاطرة (من 10)", calc.riskScore],
    ["", ""],
    ["تاريخ الإنشاء", todayStr()],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 38 }, { wch: 20 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "دراسة الجدوى");
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  triggerDownload(
    new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `Study_${study.productName}_${todayStr().replace(/\//g, "-")}.xlsx`
  );
}

// ─── PDF – Multi Feasibility Studies ─────────────────────────────────────────

export async function exportMultiStudyPDF(studies: FeasibilityStudy[]) {
  const pages: HTMLDivElement[] = [];

  // ── Summary page ──
  const summaryEl = mkContainer(794);
  const summaryRows = studies.map((s, i) => {
    const c = calculateFeasibility(s);
    const bg = i % 2 === 0 ? "#fff" : altRow;
    return `<tr style="background:${bg}">
      <td style="${tdR}">${i + 1}</td>
      <td style="${td0}">${s.productName}</td>
      <td style="${tdR}">${s.quantity.toLocaleString("en-US")}</td>
      <td style="${tdR}">${fmt(c.costPerUnitLandedSAR)}</td>
      <td style="${tdR}">${fmt(c.netProfitSAR)}</td>
      <td style="${tdR}">${fmt(c.netProfitMarginPct)}%</td>
      <td style="${tdR}">${fmt(c.roiPct)}%</td>
      <td style="${tdR};color:${c.riskScore <= 3 ? "#16a34a" : c.riskScore <= 6 ? "#d97706" : "#dc2626"};font-weight:700">${c.riskScore}/10</td>
    </tr>`;
  }).join("");

  summaryEl.innerHTML = `
<div style="padding:0">
  <div style="${hdr("#0f172a")}">
    <div style="font-size:18px;font-weight:700">تقرير دراسات الجدوى المجمّع</div>
    <div style="font-size:12px;margin-top:4px;opacity:.8">China Import Tracker — مستورد الصين — ${studies.length} دراسة — ${todayStr()}</div>
  </div>
  <div style="padding:16px 24px">
    <table style="${tblWrap}">
      <thead><tr>
        <th style="${th()}">#</th>
        <th style="${th()}">اسم المنتج</th>
        <th style="${th()}">الكمية</th>
        <th style="${th()}">تكلفة الوحدة (ر.س)</th>
        <th style="${th()}">الربح الإجمالي (ر.س)</th>
        <th style="${th()}">هامش الربح</th>
        <th style="${th()}">ROI</th>
        <th style="${th()}">المخاطرة</th>
      </tr></thead>
      <tbody>${summaryRows}</tbody>
    </table>
  </div>
  ${pageFooter()}
</div>`;
  pages.push(summaryEl);

  // ── One page per study ──
  for (const study of studies) {
    const c = calculateFeasibility(study);
    const el = mkContainer(794);
    el.innerHTML = `
<div style="padding:0">
  <div style="${hdr("#1e40af")}">
    <div style="font-size:16px;font-weight:700">${study.productName}</div>
    <div style="font-size:11px;margin-top:4px;opacity:.8">دراسة الجدوى — ${todayStr()}</div>
  </div>
  <div style="padding:16px 24px">
    <table style="${tblWrap}">
      <thead><tr>
        <th style="${th("#1e3a5f")}">المؤشر</th>
        <th style="${th("#1e3a5f")}">القيمة</th>
      </tr></thead>
      <tbody>
        ${rowHtml("إجمالي التكلفة الواصلة (ر.س)", fmt(c.totalLandedCostSAR))}
        ${rowHtml("التكلفة للوحدة (ر.س)", fmt(c.costPerUnitLandedSAR), altRow)}
        ${rowHtml("السعر الأدنى المقترح (ر.س)", fmt(c.recommendedMinPriceSAR))}
        ${rowHtml("الربح الصافي الإجمالي (ر.س)", `<span style="color:${c.netProfitSAR >= 0 ? "#16a34a" : "#dc2626"};font-weight:700">${fmt(c.netProfitSAR)}</span>`, altRow)}
        ${rowHtml("الربح الصافي للوحدة (ر.س)", `<span style="color:${c.netProfitPerUnitSAR >= 0 ? "#16a34a" : "#dc2626"};font-weight:700">${fmt(c.netProfitPerUnitSAR)}</span>`)}
        ${rowHtml("هامش الربح الصافي", `${fmt(c.netProfitMarginPct)}%`, altRow)}
        ${rowHtml("العائد على الاستثمار (ROI)", `${fmt(c.roiPct)}%`)}
        ${rowHtml("إجمالي الحجم (CBM)", fmt(c.totalCBM, 3), altRow)}
        ${rowHtml("إجمالي عدد الكراتين", `${c.totalCartons}`)}
        ${rowHtml("نسبة المخاطرة (من 10)", `<span style="color:${c.riskScore <= 3 ? "#16a34a" : c.riskScore <= 6 ? "#d97706" : "#dc2626"};font-weight:700">${c.riskScore} / 10</span>`, altRow)}
      </tbody>
    </table>
  </div>
  ${pageFooter()}
</div>`;
    pages.push(el);
  }

  await pagesToPDF(pages, `CombinedStudies_${todayStr().replace(/\//g, "-")}.pdf`);
}

// ─── Excel – Multi Feasibility Studies ───────────────────────────────────────

export function exportMultiStudyExcel(studies: FeasibilityStudy[]) {
  const wb = XLSX.utils.book_new();
  const taken: string[] = [];

  const summaryRows: any[][] = [
    ["تقرير دراسات الجدوى المجمّع — Combined Feasibility Report"],
    ["التاريخ:", todayStr(), "", "عدد الدراسات:", studies.length],
    [],
    ["#", "اسم المنتج", "الكمية", "تكلفة الوحدة (ر.س)", "السعر المقترح (ر.س)",
     "الربح الإجمالي (ر.س)", "الربح/وحدة (ر.س)", "هامش الربح %", "ROI %", "مخاطرة/10"],
    ...studies.map((s, i) => {
      const c = calculateFeasibility(s);
      return [i + 1, s.productName, s.quantity,
        +c.costPerUnitLandedSAR.toFixed(2), +c.recommendedMinPriceSAR.toFixed(2),
        +c.netProfitSAR.toFixed(2), +c.netProfitPerUnitSAR.toFixed(2),
        +c.netProfitMarginPct.toFixed(2), +c.roiPct.toFixed(2), c.riskScore];
    }),
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary["!cols"] = [
    { wch: 5 }, { wch: 30 }, { wch: 10 }, { wch: 18 }, { wch: 18 },
    { wch: 20 }, { wch: 18 }, { wch: 14 }, { wch: 10 }, { wch: 10 },
  ];
  const sName = safeSheetName("ملخص", taken);
  taken.push(sName);
  XLSX.utils.book_append_sheet(wb, wsSummary, sName);

  studies.forEach((study) => {
    const calc = calculateFeasibility(study);
    const rows: any[][] = [
      ["دراسة الجدوى — Feasibility Study"],
      ["المنتج:", study.productName],
      ["التاريخ:", todayStr()],
      [],
      ["البند", "القيمة"],
      ["العملة", study.currency],
      ["سعر المصنع للوحدة", study.factoryPrice],
      ["الكمية", study.quantity],
      ["إجمالي التكلفة الواصلة (ر.س)", +calc.totalLandedCostSAR.toFixed(2)],
      ["التكلفة للوحدة (ر.س)", +calc.costPerUnitLandedSAR.toFixed(2)],
      ["السعر المقترح للبيع (ر.س)", +calc.recommendedMinPriceSAR.toFixed(2)],
      ["سعر البيع المستهدف (ر.س)", study.targetSellingPrice],
      ["الربح الإجمالي (ر.س)", +calc.netProfitSAR.toFixed(2)],
      ["الربح للوحدة (ر.س)", +calc.netProfitPerUnitSAR.toFixed(2)],
      ["هامش الربح %", +calc.netProfitMarginPct.toFixed(2)],
      ["ROI %", +calc.roiPct.toFixed(2)],
      ["إجمالي CBM", +calc.totalCBM.toFixed(3)],
      ["إجمالي الكراتين", calc.totalCartons],
      ["نسبة المخاطرة (من 10)", calc.riskScore],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 32 }, { wch: 20 }];
    const shName = safeSheetName(study.productName, taken);
    taken.push(shName);
    XLSX.utils.book_append_sheet(wb, ws, shName);
  });

  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  triggerDownload(
    new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `CombinedStudies_${todayStr().replace(/\//g, "-")}.xlsx`
  );
}

// ─── PDF – Packing List ───────────────────────────────────────────────────────

export async function exportPackingListPDF(list: PackingList) {
  const totals = calculatePackingListTotals(list.items);

  const itemRows = list.items.map((item, i) => {
    const cbm = ((item.length * item.width * item.height) / 1_000_000).toFixed(4);
    const totalVal = (item.unitValueUSD * item.unitsPerCarton * item.cartonsCount).toFixed(2);
    const bg = i % 2 === 0 ? "#fff" : altRow;
    return `<tr style="background:${bg}">
      <td style="${tdR}">${i + 1}</td>
      <td style="${td0}">${item.productName}</td>
      <td style="${tdR}">${item.cartonsCount}</td>
      <td style="${tdR}">${item.unitsPerCarton}</td>
      <td style="${tdR}">${item.netWeightPerCarton}</td>
      <td style="${tdR}">${item.grossWeightPerCarton}</td>
      <td style="${tdR}">${item.length}×${item.width}×${item.height}</td>
      <td style="${tdR}">${cbm}</td>
      <td style="${tdR}">$${item.unitValueUSD.toFixed(2)}</td>
      <td style="${tdR};font-weight:700">$${totalVal}</td>
    </tr>`;
  }).join("");

  const el = mkContainer(1060);
  el.innerHTML = `
<div style="padding:0">
  <div style="${hdr("#0f172a")}">
    <div style="font-size:18px;font-weight:700">بيان التعبئة — PACKING LIST</div>
    <div style="font-size:12px;margin-top:4px;opacity:.8">China Import Tracker — مستورد الصين</div>
  </div>

  <div style="padding:14px 24px;background:#f8fafc;border-bottom:1px solid #e2e8f0">
    <table style="width:100%;font-size:12px">
      <tr>
        <td style="padding:4px 8px;font-weight:700;width:120px">المورد:</td>
        <td style="padding:4px 8px">${list.supplierName}</td>
        <td style="padding:4px 8px;font-weight:700;width:120px">رقم البوليصة:</td>
        <td style="padding:4px 8px">${list.billOfLading}</td>
      </tr>
      <tr>
        <td style="padding:4px 8px;font-weight:700">وصف البضاعة:</td>
        <td style="padding:4px 8px" colspan="3">${list.goodsDescription}</td>
      </tr>
      <tr>
        <td style="padding:4px 8px;font-weight:700">التاريخ:</td>
        <td style="padding:4px 8px">${todayStr()}</td>
        <td></td><td></td>
      </tr>
    </table>
  </div>

  <div style="padding:16px 24px 0">
    <table style="${tblWrap}">
      <thead><tr>
        <th style="${th("#1e40af")}">#</th>
        <th style="${th("#1e40af")}">المنتج</th>
        <th style="${th("#1e40af")}">كراتين</th>
        <th style="${th("#1e40af")}">قطع/كرتون</th>
        <th style="${th("#1e40af")}">NW/كرتون</th>
        <th style="${th("#1e40af")}">GW/كرتون</th>
        <th style="${th("#1e40af")}">الأبعاد (سم)</th>
        <th style="${th("#1e40af")}">CBM</th>
        <th style="${th("#1e40af")}">قيمة الوحدة</th>
        <th style="${th("#1e40af")}">القيمة الإجمالية</th>
      </tr></thead>
      <tbody>
        ${itemRows}
        <tr style="background:#0f172a;color:#fff;font-weight:700">
          <td style="padding:8px 12px;border:1px solid #1e293b;text-align:center" colspan="2">الإجمالي</td>
          <td style="padding:8px 12px;border:1px solid #1e293b;text-align:center">${totals.totalCartons}</td>
          <td style="padding:8px 12px;border:1px solid #1e293b"></td>
          <td style="padding:8px 12px;border:1px solid #1e293b;text-align:center">${totals.totalNetWeight.toFixed(2)} كج</td>
          <td style="padding:8px 12px;border:1px solid #1e293b;text-align:center">${totals.totalGrossWeight.toFixed(2)} كج</td>
          <td style="padding:8px 12px;border:1px solid #1e293b"></td>
          <td style="padding:8px 12px;border:1px solid #1e293b;text-align:center">${totals.totalCBM.toFixed(3)} م³</td>
          <td style="padding:8px 12px;border:1px solid #1e293b"></td>
          <td style="padding:8px 12px;border:1px solid #1e293b;text-align:center">$${totals.totalValueUSD.toFixed(2)}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div style="padding:16px 24px 20px">
    ${pageFooter()}
  </div>
</div>`;

  await pagesToPDF(
    [el],
    `PackingList_${list.billOfLading}_${todayStr().replace(/\//g, "-")}.pdf`,
    "landscape"
  );
}

// ─── Excel – Packing List ─────────────────────────────────────────────────────

export function exportPackingListExcel(list: PackingList) {
  const totals = calculatePackingListTotals(list.items);
  const headerRows: any[][] = [
    ["بيان التعبئة — Packing List"],
    ["المورد:", list.supplierName],
    ["رقم البوليصة:", list.billOfLading],
    ["وصف البضاعة:", list.goodsDescription],
    ["التاريخ:", todayStr()],
    [],
    ["#", "المنتج / Product", "عدد الكراتين", "قطع/كرتون", "وزن صافي/كرتون (كج)",
     "وزن إجمالي/كرتون (كج)", "الطول (سم)", "العرض (سم)", "الارتفاع (سم)", "قيمة الوحدة (USD)"],
    ...list.items.map((item, i) => [
      i + 1, item.productName, item.cartonsCount, item.unitsPerCarton,
      item.netWeightPerCarton, item.grossWeightPerCarton,
      item.length, item.width, item.height, item.unitValueUSD,
    ]),
    [],
    ["الإجماليات", "", totals.totalCartons, "",
     +totals.totalNetWeight.toFixed(2), +totals.totalGrossWeight.toFixed(2),
     "", "", "", +totals.totalValueUSD.toFixed(2)],
    [],
    ["إجمالي CBM:", +totals.totalCBM.toFixed(3)],
  ];
  const ws = XLSX.utils.aoa_to_sheet(headerRows);
  ws["!cols"] = [
    { wch: 6 }, { wch: 30 }, { wch: 14 }, { wch: 10 },
    { wch: 20 }, { wch: 22 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 20 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Packing List");
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  triggerDownload(
    new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `PackingList_${list.billOfLading}_${todayStr().replace(/\//g, "-")}.xlsx`
  );
}

// ─── PDF – Multi Packing List ─────────────────────────────────────────────────

export async function exportMultiPackingListPDF(lists: PackingList[]) {
  const pages: HTMLDivElement[] = [];

  // Summary page
  const summaryEl = mkContainer(1060);
  const gTotals = lists.map(l => calculatePackingListTotals(l.items));
  const summaryRows = lists.map((list, i) => {
    const t = gTotals[i];
    const bg = i % 2 === 0 ? "#fff" : altRow;
    return `<tr style="background:${bg}">
      <td style="${tdR}">${i + 1}</td>
      <td style="${td0}">${list.supplierName}</td>
      <td style="${td0}">${list.billOfLading}</td>
      <td style="${td0}">${list.goodsDescription}</td>
      <td style="${tdR}">${list.items.length}</td>
      <td style="${tdR}">${t.totalCartons}</td>
      <td style="${tdR}">${t.totalCBM.toFixed(3)}</td>
      <td style="${tdR}">${t.totalGrossWeight.toFixed(2)} كج</td>
      <td style="${tdR};font-weight:700">$${t.totalValueUSD.toFixed(2)}</td>
    </tr>`;
  }).join("");

  const grandCartons = gTotals.reduce((s, t) => s + t.totalCartons, 0);
  const grandCBM    = gTotals.reduce((s, t) => s + t.totalCBM, 0);
  const grandGW     = gTotals.reduce((s, t) => s + t.totalGrossWeight, 0);
  const grandUSD    = gTotals.reduce((s, t) => s + t.totalValueUSD, 0);

  summaryEl.innerHTML = `
<div style="padding:0">
  <div style="${hdr("#0f172a")}">
    <div style="font-size:18px;font-weight:700">بيانات التعبئة المجمّعة</div>
    <div style="font-size:12px;margin-top:4px;opacity:.8">China Import Tracker — مستورد الصين — ${lists.length} شحنة — ${todayStr()}</div>
  </div>
  <div style="padding:16px 24px">
    <table style="${tblWrap}">
      <thead><tr>
        <th style="${th()}">#</th>
        <th style="${th()}">المورد</th>
        <th style="${th()}">رقم البوليصة</th>
        <th style="${th()}">وصف البضاعة</th>
        <th style="${th()}">الأصناف</th>
        <th style="${th()}">الكراتين</th>
        <th style="${th()}">CBM (م³)</th>
        <th style="${th()}">الوزن الإجمالي</th>
        <th style="${th()}">القيمة (USD)</th>
      </tr></thead>
      <tbody>
        ${summaryRows}
        <tr style="background:#f59e0b;font-weight:700">
          <td style="${tdR}" colspan="5">الإجمالي الكلي</td>
          <td style="${tdR}">${grandCartons}</td>
          <td style="${tdR}">${grandCBM.toFixed(3)}</td>
          <td style="${tdR}">${grandGW.toFixed(2)} كج</td>
          <td style="${tdR}">$${grandUSD.toFixed(2)}</td>
        </tr>
      </tbody>
    </table>
  </div>
  ${pageFooter()}
</div>`;
  pages.push(summaryEl);

  // One page per packing list
  for (const list of lists) {
    const totals = calculatePackingListTotals(list.items);
    const itemRows = list.items.map((item, i) => {
      const cbm = ((item.length * item.width * item.height) / 1_000_000).toFixed(4);
      const totalVal = (item.unitValueUSD * item.unitsPerCarton * item.cartonsCount).toFixed(2);
      const bg = i % 2 === 0 ? "#fff" : altRow;
      return `<tr style="background:${bg}">
        <td style="${tdR}">${i + 1}</td>
        <td style="${td0}">${item.productName}</td>
        <td style="${tdR}">${item.cartonsCount}</td>
        <td style="${tdR}">${item.unitsPerCarton}</td>
        <td style="${tdR}">${item.netWeightPerCarton}</td>
        <td style="${tdR}">${item.grossWeightPerCarton}</td>
        <td style="${tdR}">${item.length}×${item.width}×${item.height}</td>
        <td style="${tdR}">${cbm}</td>
        <td style="${tdR}">$${item.unitValueUSD.toFixed(2)}</td>
        <td style="${tdR};font-weight:700">$${totalVal}</td>
      </tr>`;
    }).join("");

    const el = mkContainer(1060);
    el.innerHTML = `
<div style="padding:0">
  <div style="${hdr("#1e40af")}">
    <div style="font-size:16px;font-weight:700">${list.supplierName} — ${list.billOfLading}</div>
    <div style="font-size:11px;margin-top:4px;opacity:.8">${list.goodsDescription} — ${todayStr()}</div>
  </div>
  <div style="padding:16px 24px 0">
    <table style="${tblWrap}">
      <thead><tr>
        <th style="${th("#1e40af")}">#</th>
        <th style="${th("#1e40af")}">المنتج</th>
        <th style="${th("#1e40af")}">كراتين</th>
        <th style="${th("#1e40af")}">قطع/كرتون</th>
        <th style="${th("#1e40af")}">NW/كرتون</th>
        <th style="${th("#1e40af")}">GW/كرتون</th>
        <th style="${th("#1e40af")}">الأبعاد (سم)</th>
        <th style="${th("#1e40af")}">CBM</th>
        <th style="${th("#1e40af")}">قيمة الوحدة</th>
        <th style="${th("#1e40af")}">القيمة الإجمالية</th>
      </tr></thead>
      <tbody>
        ${itemRows}
        <tr style="background:#0f172a;color:#fff;font-weight:700">
          <td style="padding:8px 12px;border:1px solid #1e293b;text-align:center" colspan="2">الإجمالي</td>
          <td style="padding:8px 12px;border:1px solid #1e293b;text-align:center">${totals.totalCartons}</td>
          <td style="padding:8px 12px;border:1px solid #1e293b"></td>
          <td style="padding:8px 12px;border:1px solid #1e293b;text-align:center">${totals.totalNetWeight.toFixed(2)} كج</td>
          <td style="padding:8px 12px;border:1px solid #1e293b;text-align:center">${totals.totalGrossWeight.toFixed(2)} كج</td>
          <td style="padding:8px 12px;border:1px solid #1e293b"></td>
          <td style="padding:8px 12px;border:1px solid #1e293b;text-align:center">${totals.totalCBM.toFixed(3)} م³</td>
          <td style="padding:8px 12px;border:1px solid #1e293b"></td>
          <td style="padding:8px 12px;border:1px solid #1e293b;text-align:center">$${totals.totalValueUSD.toFixed(2)}</td>
        </tr>
      </tbody>
    </table>
  </div>
  ${pageFooter()}
</div>`;
    pages.push(el);
  }

  await pagesToPDF(
    pages,
    `CombinedPackingList_${todayStr().replace(/\//g, "-")}.pdf`,
    "landscape"
  );
}

// ─── Excel – Multi Packing List ───────────────────────────────────────────────

export function exportMultiPackingListExcel(lists: PackingList[]) {
  const wb = XLSX.utils.book_new();
  const taken: string[] = [];

  const summaryRows: any[][] = [
    ["تقرير بيانات التعبئة المجمّع — Combined Packing List Report"],
    ["التاريخ:", todayStr(), "", "عدد الشحنات:", lists.length],
    [],
    ["#", "المورد", "رقم البوليصة", "وصف البضاعة", "عدد الأصناف",
     "إجمالي الكراتين", "CBM (م³)", "الوزن الإجمالي GW (كج)", "القيمة الإجمالية USD"],
  ];

  let grandCartons = 0, grandCBM = 0, grandGW = 0, grandUSD = 0;
  lists.forEach((list, i) => {
    const t = calculatePackingListTotals(list.items);
    grandCartons += t.totalCartons;
    grandCBM += t.totalCBM;
    grandGW += t.totalGrossWeight;
    grandUSD += t.totalValueUSD;
    summaryRows.push([
      i + 1, list.supplierName, list.billOfLading, list.goodsDescription,
      list.items.length, t.totalCartons, +t.totalCBM.toFixed(3),
      +t.totalGrossWeight.toFixed(2), +t.totalValueUSD.toFixed(2),
    ]);
  });
  summaryRows.push([]);
  summaryRows.push([
    "الإجمالي الكلي", "", "", "", "",
    grandCartons, +grandCBM.toFixed(3), +grandGW.toFixed(2), +grandUSD.toFixed(2),
  ]);

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary["!cols"] = [
    { wch: 5 }, { wch: 25 }, { wch: 18 }, { wch: 22 },
    { wch: 12 }, { wch: 15 }, { wch: 16 }, { wch: 18 }, { wch: 18 },
  ];
  const sName = safeSheetName("Summary", taken);
  taken.push(sName);
  XLSX.utils.book_append_sheet(wb, wsSummary, sName);

  lists.forEach((list) => {
    const t = calculatePackingListTotals(list.items);
    const rows: any[][] = [
      ["بيان التعبئة — Packing List"],
      ["المورد:", list.supplierName],
      ["رقم البوليصة:", list.billOfLading],
      ["وصف البضاعة:", list.goodsDescription],
      ["التاريخ:", todayStr()],
      [],
      ["#", "المنتج", "الكراتين", "قطع/كرتون", "NW/كرتون كج", "GW/كرتون كج",
       "طول سم", "عرض سم", "ارتفاع سم", "قيمة الوحدة USD", "القيمة الإجمالية USD"],
      ...list.items.map((item, i) => {
        const totalValue = item.unitValueUSD * item.unitsPerCarton * item.cartonsCount;
        return [
          i + 1, item.productName, item.cartonsCount, item.unitsPerCarton,
          item.netWeightPerCarton, item.grossWeightPerCarton,
          item.length, item.width, item.height,
          item.unitValueUSD, +totalValue.toFixed(2),
        ];
      }),
      [],
      ["Totals", "", t.totalCartons, "",
       +t.totalNetWeight.toFixed(2), +t.totalGrossWeight.toFixed(2),
       "", "", "", "", +t.totalValueUSD.toFixed(2)],
      ["إجمالي CBM:", +t.totalCBM.toFixed(3)],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [
      { wch: 5 }, { wch: 28 }, { wch: 12 }, { wch: 12 },
      { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 10 },
      { wch: 12 }, { wch: 16 }, { wch: 16 },
    ];
    const shName = safeSheetName(list.billOfLading || list.supplierName, taken);
    taken.push(shName);
    XLSX.utils.book_append_sheet(wb, ws, shName);
  });

  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  triggerDownload(
    new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `CombinedPackingList_${todayStr().replace(/\//g, "-")}.xlsx`
  );
}

// ─── PDF – Shipments Tracker ──────────────────────────────────────────────────

export async function exportShipmentsPDF(shipments: Shipment[]) {
  const stages = ["تم الشراء", "في مستودع الصين", "في البحر / الجو", "التخليص الجمركي", "واصل للمستودع"];

  const summaryRows = stages.map((s, i) => {
    const count = shipments.filter(sh => sh.stage === s).length;
    const bg = i % 2 === 0 ? "#fff" : altRow;
    return `<tr style="background:${bg}">
      <td style="${td0}">${s}</td>
      <td style="${tdR};font-weight:700">${count}</td>
    </tr>`;
  }).join("");

  const shipmentRows = shipments.map((s, i) => {
    const bg = i % 2 === 0 ? "#fff" : altRow;
    return `<tr style="background:${bg}">
      <td style="${tdR}">${i + 1}</td>
      <td style="${td0}">${s.name}</td>
      <td style="${td0}">${s.productName}</td>
      <td style="${td0}">${s.supplier}</td>
      <td style="${tdR}">${s.containerNumber || "—"}</td>
      <td style="${td0}">${s.stage}</td>
      <td style="${tdR}">${new Date(s.updatedAt).toLocaleDateString("en-GB")}</td>
      <td style="${tdR}">${s.notes.length}</td>
    </tr>`;
  }).join("");

  const el = mkContainer(1060);
  el.innerHTML = `
<div style="padding:0">
  <div style="${hdr("#0f172a")}">
    <div style="font-size:18px;font-weight:700">تقرير متابعة الشحنات — Shipments Tracker Report</div>
    <div style="font-size:12px;margin-top:4px;opacity:.8">China Import Tracker — مستورد الصين — إجمالي: ${shipments.length} شحنة — ${todayStr()}</div>
  </div>

  <div style="padding:16px 24px 0;display:flex;gap:24px">
    <div style="flex:0 0 260px">
      <div style="font-weight:700;font-size:13px;margin-bottom:8px;color:#0f172a">ملخص المراحل</div>
      <table style="${tblWrap}">
        <thead><tr>
          <th style="${th("#1e3a5f")}">المرحلة</th>
          <th style="${th("#1e3a5f")}">العدد</th>
        </tr></thead>
        <tbody>${summaryRows}</tbody>
      </table>
    </div>
    <div style="flex:1"></div>
  </div>

  <div style="padding:16px 24px 0">
    <div style="font-weight:700;font-size:13px;margin-bottom:8px;color:#0f172a">جميع الشحنات</div>
    <table style="${tblWrap}">
      <thead><tr>
        <th style="${th("#1e40af")}">#</th>
        <th style="${th("#1e40af")}">اسم الشحنة</th>
        <th style="${th("#1e40af")}">المنتج</th>
        <th style="${th("#1e40af")}">المورد</th>
        <th style="${th("#1e40af")}">رقم الحاوية</th>
        <th style="${th("#1e40af")}">المرحلة</th>
        <th style="${th("#1e40af")}">آخر تحديث</th>
        <th style="${th("#1e40af")}">ملاحظات</th>
      </tr></thead>
      <tbody>${shipmentRows}</tbody>
    </table>
  </div>

  <div style="padding:16px 24px 20px">
    ${pageFooter()}
  </div>
</div>`;

  await pagesToPDF(
    [el],
    `Shipments_${todayStr().replace(/\//g, "-")}.pdf`,
    "landscape"
  );
}

// ─── Excel – Shipments Tracker ────────────────────────────────────────────────

export function exportShipmentsExcel(shipments: Shipment[]) {
  const wb = XLSX.utils.book_new();
  const stages = ["تم الشراء", "في مستودع الصين", "في البحر / الجو", "التخليص الجمركي", "واصل للمستودع"];

  const summaryRows: any[][] = [
    ["تقرير متابعة الشحنات — Shipments Tracker Report"],
    ["التاريخ:", todayStr(), "", "إجمالي الشحنات:", shipments.length],
    [],
    ["المرحلة", "عدد الشحنات"],
    ...stages.map(s => [s, shipments.filter(sh => sh.stage === s).length]),
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary["!cols"] = [{ wch: 30 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, "ملخص المراحل");

  const allRows: any[][] = [
    ["#", "اسم الشحنة", "المنتج", "المورد", "رقم الحاوية", "المرحلة الحالية",
     "تاريخ الإنشاء", "آخر تحديث", "عدد الملاحظات"],
    ...shipments.map((s, i) => [
      i + 1, s.name, s.productName, s.supplier,
      s.containerNumber || "—", s.stage,
      new Date(s.createdAt).toLocaleDateString("en-GB"),
      new Date(s.updatedAt).toLocaleDateString("en-GB"),
      s.notes.length,
    ]),
  ];
  const wsAll = XLSX.utils.aoa_to_sheet(allRows);
  wsAll["!cols"] = [
    { wch: 5 }, { wch: 30 }, { wch: 25 }, { wch: 25 },
    { wch: 18 }, { wch: 20 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(wb, wsAll, "جميع الشحنات");

  const noteRows: any[][] = [
    ["اسم الشحنة", "المرحلة", "التاريخ والوقت", "محتوى الملاحظة"],
  ];
  shipments.forEach(s => {
    s.notes.forEach(n => {
      noteRows.push([s.name, s.stage, new Date(n.timestamp).toLocaleString("en-GB"), n.content]);
    });
  });
  const wsNotes = XLSX.utils.aoa_to_sheet(noteRows);
  wsNotes["!cols"] = [{ wch: 30 }, { wch: 20 }, { wch: 20 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, wsNotes, "سجل الملاحظات");

  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  triggerDownload(
    new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `Shipments_${todayStr().replace(/\//g, "-")}.xlsx`
  );
}
