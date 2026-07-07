import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { formatNumber, calculateFeasibility, calculatePackingListTotals } from "./calculations";
import { FeasibilityStudy, PackingList, Shipment } from "./storage";

// ─── helpers ────────────────────────────────────────────────────────────────

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

function safeSheetName(raw: string, taken: string[]): string {
  const clean = raw.replace(/[\/\\?*\[\]:]/g, "").trim().slice(0, 28) || "ورقة";
  let name = clean;
  let i = 2;
  while (taken.includes(name)) name = `${clean.slice(0, 25)} (${i++})`;
  return name;
}

// ─── PDF – Feasibility Study ─────────────────────────────────────────────────

export function exportStudyPDF(study: FeasibilityStudy) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const calc = calculateFeasibility(study);
  const pageW = doc.internal.pageSize.getWidth();

  // Header bar
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageW, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Feasibility Study Report", pageW / 2, 12, { align: "center" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("مستورد الصين  |  China Import Tracker", pageW / 2, 20, { align: "center" });
  doc.setTextColor(30, 30, 30);

  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(study.productName, 14, 38);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(`Date: ${todayStr()}   |   Currency: ${study.currency}   |   Qty: ${study.quantity} units`, 14, 44);
  doc.setTextColor(30, 30, 30);

  autoTable(doc, {
    startY: 50,
    head: [["Input Parameter", "Value"]],
    body: [
      ["Factory Unit Price", `${study.factoryPrice} ${study.currency}`],
      ["Quantity", `${study.quantity} units`],
      ["Units per Carton", `${study.unitsPerCarton}`],
      ["Carton Dimensions (cm)", `${study.cartonLength} × ${study.cartonWidth} × ${study.cartonHeight}`],
      ["Gross Weight / Carton (kg)", `${study.grossWeight ?? "—"}`],
      ["Domestic Shipping China (RMB)", `${study.domesticShippingRMB}`],
      ["Sea / Air Freight (SAR)", `${formatNumber(study.freightCostSAR)}`],
      ["Custom Duty %", `${study.customDutyPct}%`],
      ["VAT %", `${study.vatPct}%`],
      ["Customs Clearance Fee (SAR)", `${formatNumber(study.clearanceFeeSAR)}`],
      ["Saudi Internal Logistics (SAR)", `${formatNumber(study.localLogisticsSAR)}`],
      ["SABER / SFDA Certification (SAR)", `${formatNumber(study.certificationFeeSAR)}`],
      ["Target Selling Price / Unit (SAR)", `${formatNumber(study.targetSellingPrice)}`],
    ],
    theme: "striped",
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 90 }, 1: { halign: "right" } },
  });

  const afterInputs = (doc as any).lastAutoTable.finalY + 8;

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text("Calculated Results", 14, afterInputs);

  const riskColor: [number, number, number] =
    calc.riskScore <= 3 ? [34, 197, 94] : calc.riskScore <= 6 ? [234, 179, 8] : [239, 68, 68];

  autoTable(doc, {
    startY: afterInputs + 4,
    head: [["Result Metric", "Value"]],
    body: [
      ["Total Landed Cost (SAR)", formatNumber(calc.totalLandedCostSAR)],
      ["Cost per Unit Landed (SAR)", formatNumber(calc.costPerUnitLandedSAR)],
      ["Recommended Min. Selling Price (SAR)", formatNumber(calc.recommendedMinPriceSAR)],
      ["Net Profit (SAR) — Total", formatNumber(calc.netProfitSAR)],
      ["Net Profit per Unit (SAR)", formatNumber(calc.netProfitPerUnitSAR)],
      ["Net Profit Margin %", `${formatNumber(calc.netProfitMarginPct)}%`],
      ["ROI %", `${formatNumber(calc.roiPct)}%`],
      ["Total Volume (CBM)", formatNumber(calc.totalCBM, 3)],
      ["Total Cartons", `${calc.totalCartons}`],
      ["Risk Score", `${calc.riskScore} / 10`],
    ],
    theme: "grid",
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: "bold" },
    styles: { fontSize: 10, cellPadding: 3.5 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 90 }, 1: { halign: "right" } },
    didDrawCell: (data: any) => {
      if (data.row.index === 9 && data.column.index === 1) {
        doc.setTextColor(...riskColor);
      } else if (data.row.index === 3 || data.row.index === 4) {
        doc.setTextColor(calc.netProfitSAR >= 0 ? 22 : 239, calc.netProfitSAR >= 0 ? 163 : 68, calc.netProfitSAR >= 0 ? 74 : 68);
      } else {
        doc.setTextColor(30, 30, 30);
      }
    },
  });

  const pageH = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text("Generated by مستورد الصين  –  China Import Tracker", pageW / 2, pageH - 6, { align: "center" });

  doc.save(`جدوى_${study.productName}_${todayStr().replace(/\//g, "-")}.pdf`);
}

// ─── Excel – Feasibility Study ───────────────────────────────────────────────

export function exportStudyExcel(study: FeasibilityStudy) {
  const calc = calculateFeasibility(study);
  const rows = [
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
    ["إجمالي التكلفة واصل المستودع (ر.س)", calc.totalLandedCostSAR],
    ["التكلفة لكل وحدة واصل (ر.س)", calc.costPerUnitLandedSAR],
    ["السعر الأدنى المقترح للبيع (ر.س)", calc.recommendedMinPriceSAR],
    ["الربح الإجمالي (ر.س)", calc.netProfitSAR],
    ["الربح لكل وحدة (ر.س)", calc.netProfitPerUnitSAR],
    ["هامش الربح الصافي %", calc.netProfitMarginPct],
    ["العائد على الاستثمار ROI %", calc.roiPct],
    ["إجمالي الحجم CBM", calc.totalCBM],
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
    `جدوى_${study.productName}_${todayStr().replace(/\//g, "-")}.xlsx`
  );
}

// ─── PDF – Multi Feasibility Studies ─────────────────────────────────────────

export function exportMultiStudyPDF(studies: FeasibilityStudy[]) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // Cover header
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageW, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("COMBINED FEASIBILITY REPORT", pageW / 2, 12, { align: "center" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(
    `مستورد الصين  |  China Import Tracker  |  Date: ${todayStr()}  |  Studies: ${studies.length}`,
    pageW / 2, 21, { align: "center" }
  );

  // Summary table
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text("Summary", 14, 36);

  autoTable(doc, {
    startY: 40,
    head: [["#", "Product", "Qty", "Unit Cost (SAR)", "Net Profit (SAR)", "Margin %", "ROI %", "Risk"]],
    body: studies.map((s, i) => {
      const c = calculateFeasibility(s);
      return [
        i + 1, s.productName, s.quantity,
        formatNumber(c.costPerUnitLandedSAR),
        formatNumber(c.netProfitSAR),
        `${formatNumber(c.netProfitMarginPct)}%`,
        `${formatNumber(c.roiPct)}%`,
        `${c.riskScore}/10`,
      ];
    }),
    theme: "striped",
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: "bold", fontSize: 8 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    styles: { fontSize: 8, cellPadding: 2.5 },
    columnStyles: { 1: { cellWidth: 45 } },
  });

  // One section per study
  studies.forEach((study, idx) => {
    const calc = calculateFeasibility(study);
    doc.addPage();

    doc.setFillColor(30, 64, 175);
    doc.rect(0, 0, pageW, 20, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`[${idx + 1}]  ${study.productName}`, pageW / 2, 13, { align: "center" });
    doc.setTextColor(30, 30, 30);

    autoTable(doc, {
      startY: 26,
      head: [["Metric", "Value"]],
      body: [
        ["Total Landed Cost (SAR)", formatNumber(calc.totalLandedCostSAR)],
        ["Cost / Unit (SAR)", formatNumber(calc.costPerUnitLandedSAR)],
        ["Min. Selling Price (SAR)", formatNumber(calc.recommendedMinPriceSAR)],
        ["Net Profit Total (SAR)", formatNumber(calc.netProfitSAR)],
        ["Net Profit / Unit (SAR)", formatNumber(calc.netProfitPerUnitSAR)],
        ["Profit Margin %", `${formatNumber(calc.netProfitMarginPct)}%`],
        ["ROI %", `${formatNumber(calc.roiPct)}%`],
        ["CBM", formatNumber(calc.totalCBM, 3)],
        ["Cartons", `${calc.totalCartons}`],
        ["Risk Score", `${calc.riskScore} / 10`],
      ],
      theme: "grid",
      headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: "bold" },
      styles: { fontSize: 9.5, cellPadding: 3 },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 80 }, 1: { halign: "right" } },
    });
  });

  const lastPageH = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text("Generated by مستورد الصين  –  China Import Tracker", pageW / 2, lastPageH - 6, { align: "center" });

  doc.save(`CombinedStudies_${todayStr().replace(/\//g, "-")}.pdf`);
}

// ─── Excel – Multi Feasibility Studies ───────────────────────────────────────

export function exportMultiStudyExcel(studies: FeasibilityStudy[]) {
  const wb = XLSX.utils.book_new();
  const taken: string[] = [];

  // Summary sheet
  const summaryRows: any[][] = [
    ["تقرير دراسات الجدوى المجمّع  –  Combined Feasibility Report"],
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

  // One sheet per study
  studies.forEach((study) => {
    const calc = calculateFeasibility(study);
    const rows: any[][] = [
      ["دراسة الجدوى  –  Feasibility Study"],
      ["اسم المنتج:", study.productName],
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
      ["CBM الإجمالي", +calc.totalCBM.toFixed(3)],
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

// ─── PDF – Packing List ──────────────────────────────────────────────────────

export function exportPackingListPDF(list: PackingList) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const totals = calculatePackingListTotals(list.items);
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageW, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("PACKING LIST  /  بيان التعبئة", pageW / 2, 12, { align: "center" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("مستورد الصين  |  China Import Tracker", pageW / 2, 20, { align: "center" });

  doc.setTextColor(30, 30, 30);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Supplier:", 14, 36);
  doc.text("B/L No:", 14, 42);
  doc.text("Description:", 14, 48);
  doc.text("Date:", 14, 54);
  doc.setFont("helvetica", "normal");
  doc.text(list.supplierName, 48, 36);
  doc.text(list.billOfLading, 48, 42);
  doc.text(list.goodsDescription, 48, 48);
  doc.text(todayStr(), 48, 54);

  autoTable(doc, {
    startY: 60,
    head: [["#", "Product / المنتج", "Cartons", "Units/Ctn", "NW/Ctn (kg)", "GW/Ctn (kg)", "L×W×H (cm)", "CBM/Ctn", "Unit Value (USD)", "Total Value (USD)"]],
    body: [
      ...list.items.map((item, i) => {
        const cbm = (item.length * item.width * item.height) / 1_000_000;
        const totalValue = item.unitValueUSD * item.unitsPerCarton * item.cartonsCount;
        return [
          i + 1, item.productName, item.cartonsCount, item.unitsPerCarton,
          item.netWeightPerCarton, item.grossWeightPerCarton,
          `${item.length}×${item.width}×${item.height}`,
          cbm.toFixed(3), item.unitValueUSD.toFixed(2), totalValue.toFixed(2),
        ];
      }),
      [
        { content: "TOTAL", colSpan: 2, styles: { fontStyle: "bold", fillColor: [15, 23, 42], textColor: 255 } },
        { content: totals.totalCartons, styles: { fontStyle: "bold", fillColor: [15, 23, 42], textColor: 255 } },
        { content: "", styles: { fillColor: [15, 23, 42] } },
        { content: totals.totalNetWeight.toFixed(2) + " kg", styles: { fontStyle: "bold", fillColor: [15, 23, 42], textColor: 255 } },
        { content: totals.totalGrossWeight.toFixed(2) + " kg", styles: { fontStyle: "bold", fillColor: [15, 23, 42], textColor: 255 } },
        { content: "", styles: { fillColor: [15, 23, 42] } },
        { content: totals.totalCBM.toFixed(3) + " m³", styles: { fontStyle: "bold", fillColor: [15, 23, 42], textColor: 255 } },
        { content: "", styles: { fillColor: [15, 23, 42] } },
        { content: "$ " + totals.totalValueUSD.toFixed(2), styles: { fontStyle: "bold", fillColor: [15, 23, 42], textColor: 255 } },
      ],
    ],
    theme: "striped",
    headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: "bold", fontSize: 9 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    styles: { fontSize: 8.5, cellPadding: 2.5, halign: "center" },
    columnStyles: { 1: { halign: "left" } },
  });

  const pageH = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text("Generated by مستورد الصين  –  China Import Tracker", pageW / 2, pageH - 6, { align: "center" });

  doc.save(`PackingList_${list.billOfLading}_${todayStr().replace(/\//g, "-")}.pdf`);
}

// ─── Excel – Packing List ────────────────────────────────────────────────────

export function exportPackingListExcel(list: PackingList) {
  const totals = calculatePackingListTotals(list.items);

  const headerRows: any[][] = [
    ["بيان التعبئة  –  Packing List", "", "", "", "", "", "", "", "", ""],
    ["المورد / Supplier:", list.supplierName, "", "", "", "", "", "", "", ""],
    ["رقم البوليصة / B/L No:", list.billOfLading, "", "", "", "", "", "", "", ""],
    ["وصف البضاعة / Description:", list.goodsDescription, "", "", "", "", "", "", "", ""],
    ["التاريخ / Date:", todayStr(), "", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", "", "", ""],
    ["#", "المنتج / Product", "عدد الكراتين", "قطع/كرتون", "وزن صافي/كرتون (كغ)",
     "وزن إجمالي/كرتون (كغ)", "الطول (سم)", "العرض (سم)", "الارتفاع (سم)", "القيمة لكل وحدة (USD)"],
    ...list.items.map((item, i) => [
      i + 1, item.productName, item.cartonsCount, item.unitsPerCarton,
      item.netWeightPerCarton, item.grossWeightPerCarton,
      item.length, item.width, item.height, item.unitValueUSD,
    ]),
    ["", "", "", "", "", "", "", "", "", ""],
    ["الإجماليات", "", totals.totalCartons, "",
     +totals.totalNetWeight.toFixed(2), +totals.totalGrossWeight.toFixed(2),
     "", "", "", +totals.totalValueUSD.toFixed(2)],
    ["", "", "", "", "", "", "", "", "", ""],
    ["إجمالي الحجم (CBM):", +totals.totalCBM.toFixed(3), "", "", "", "", "", "", "", ""],
  ];

  const ws = XLSX.utils.aoa_to_sheet(headerRows);
  ws["!cols"] = [
    { wch: 6 }, { wch: 30 }, { wch: 14 }, { wch: 10 },
    { wch: 20 }, { wch: 22 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 20 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "بيان التعبئة");

  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  triggerDownload(
    new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `PackingList_${list.billOfLading}_${todayStr().replace(/\//g, "-")}.xlsx`
  );
}

// ─── PDF – Multi Packing List ────────────────────────────────────────────────

export function exportMultiPackingListPDF(lists: PackingList[]) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageW, 32, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("COMBINED PACKING LIST REPORT", pageW / 2, 14, { align: "center" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(
    `مستورد الصين  |  China Import Tracker  |  Date: ${todayStr()}  |  Shipments: ${lists.length}`,
    pageW / 2, 24, { align: "center" }
  );

  let currentY = 36;

  lists.forEach((list, idx) => {
    const totals = calculatePackingListTotals(list.items);
    if (currentY > pageH - 60) { doc.addPage(); currentY = 14; }

    doc.setFillColor(30, 64, 175);
    doc.rect(0, currentY, pageW, 8, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(
      `[${idx + 1}]  Supplier: ${list.supplierName}   |   B/L: ${list.billOfLading}   |   ${list.goodsDescription}`,
      6, currentY + 5.5
    );
    doc.setTextColor(30, 30, 30);
    currentY += 10;

    autoTable(doc, {
      startY: currentY,
      head: [["#", "Product / المنتج", "Cartons", "Units/Ctn", "NW/Ctn kg", "GW/Ctn kg", "L×W×H cm", "CBM/Ctn", "Unit USD", "Total USD"]],
      body: [
        ...list.items.map((item, i) => {
          const cbm = (item.length * item.width * item.height) / 1_000_000;
          const totalValue = item.unitValueUSD * item.unitsPerCarton * item.cartonsCount;
          return [
            i + 1, item.productName, item.cartonsCount, item.unitsPerCarton,
            item.netWeightPerCarton, item.grossWeightPerCarton,
            `${item.length}×${item.width}×${item.height}`,
            cbm.toFixed(3), item.unitValueUSD.toFixed(2), totalValue.toFixed(2),
          ];
        }),
        [
          { content: "SUB-TOTAL", colSpan: 2, styles: { fontStyle: "bold", fillColor: [15, 23, 42], textColor: 255 } },
          { content: totals.totalCartons, styles: { fontStyle: "bold", fillColor: [15, 23, 42], textColor: 255 } },
          { content: "", styles: { fillColor: [15, 23, 42] } },
          { content: totals.totalNetWeight.toFixed(2) + " kg", styles: { fontStyle: "bold", fillColor: [15, 23, 42], textColor: 255 } },
          { content: totals.totalGrossWeight.toFixed(2) + " kg", styles: { fontStyle: "bold", fillColor: [15, 23, 42], textColor: 255 } },
          { content: "", styles: { fillColor: [15, 23, 42] } },
          { content: totals.totalCBM.toFixed(3) + " m³", styles: { fontStyle: "bold", fillColor: [15, 23, 42], textColor: 255 } },
          { content: "", styles: { fillColor: [15, 23, 42] } },
          { content: "$ " + totals.totalValueUSD.toFixed(2), styles: { fontStyle: "bold", fillColor: [15, 23, 42], textColor: 255 } },
        ],
      ],
      theme: "striped",
      headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: "bold", fontSize: 8 },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      styles: { fontSize: 7.5, cellPadding: 2, halign: "center" },
      columnStyles: { 1: { halign: "left" } },
      margin: { left: 6, right: 6 },
    });

    currentY = (doc as any).lastAutoTable.finalY + 8;
  });

  // Grand totals
  const grandCartons = lists.reduce((s, l) => s + calculatePackingListTotals(l.items).totalCartons, 0);
  const grandCBM = lists.reduce((s, l) => s + calculatePackingListTotals(l.items).totalCBM, 0);
  const grandGW = lists.reduce((s, l) => s + calculatePackingListTotals(l.items).totalGrossWeight, 0);
  const grandUSD = lists.reduce((s, l) => s + calculatePackingListTotals(l.items).totalValueUSD, 0);

  if (currentY > pageH - 30) { doc.addPage(); currentY = 14; }

  doc.setFillColor(245, 197, 24);
  doc.rect(6, currentY, pageW - 12, 12, "F");
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(
    `GRAND TOTAL  —  Shipments: ${lists.length}   |   Cartons: ${grandCartons}   |   CBM: ${grandCBM.toFixed(3)} m³   |   GW: ${grandGW.toFixed(2)} kg   |   Value: $ ${grandUSD.toFixed(2)}`,
    pageW / 2, currentY + 7.5, { align: "center" }
  );

  doc.setFontSize(7.5);
  doc.setTextColor(150, 150, 150);
  doc.text("Generated by مستورد الصين  –  China Import Tracker", pageW / 2, pageH - 5, { align: "center" });

  doc.save(`CombinedPackingList_${todayStr().replace(/\//g, "-")}.pdf`);
}

// ─── Excel – Multi Packing List ──────────────────────────────────────────────

export function exportMultiPackingListExcel(lists: PackingList[]) {
  const wb = XLSX.utils.book_new();
  const taken: string[] = [];

  const summaryRows: any[][] = [
    ["تقرير بيانات التعبئة المجمّع  –  Combined Packing List Report"],
    ["التاريخ / Date:", todayStr()],
    ["عدد الشحنات / Shipments:", lists.length],
    [],
    ["#", "المورد / Supplier", "رقم البوليصة / B/L", "وصف البضاعة", "عدد الأصناف",
     "إجمالي الكراتين", "CBM الإجمالي (م³)", "الوزن الإجمالي GW (كج)", "القيمة الإجمالية USD"],
  ];

  let grandCartons = 0, grandCBM = 0, grandGW = 0, grandUSD = 0;
  lists.forEach((list, i) => {
    const t = calculatePackingListTotals(list.items);
    grandCartons += t.totalCartons; grandCBM += t.totalCBM;
    grandGW += t.totalGrossWeight; grandUSD += t.totalValueUSD;
    summaryRows.push([
      i + 1, list.supplierName, list.billOfLading, list.goodsDescription,
      list.items.length, t.totalCartons, +t.totalCBM.toFixed(3),
      +t.totalGrossWeight.toFixed(2), +t.totalValueUSD.toFixed(2),
    ]);
  });
  summaryRows.push([]);
  summaryRows.push(["الإجمالي الكلي", "", "", "", "", grandCartons, +grandCBM.toFixed(3), +grandGW.toFixed(2), +grandUSD.toFixed(2)]);

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary["!cols"] = [
    { wch: 5 }, { wch: 25 }, { wch: 18 }, { wch: 22 },
    { wch: 12 }, { wch: 15 }, { wch: 16 }, { wch: 18 }, { wch: 18 },
  ];
  const sName = safeSheetName("ملخص", taken);
  taken.push(sName);
  XLSX.utils.book_append_sheet(wb, wsSummary, sName);

  lists.forEach((list) => {
    const t = calculatePackingListTotals(list.items);
    const rows: any[][] = [
      ["بيان التعبئة  –  Packing List"],
      ["المورد:", list.supplierName], ["رقم البوليصة:", list.billOfLading],
      ["وصف البضاعة:", list.goodsDescription], ["التاريخ:", todayStr()], [],
      ["#", "المنتج", "الكراتين", "قطع/كرتون", "NW/كرتون كج", "GW/كرتون كج", "طول سم", "عرض سم", "ارتفاع سم", "قيمة الوحدة USD", "القيمة الإجمالية USD"],
      ...list.items.map((item, i) => {
        const totalValue = item.unitValueUSD * item.unitsPerCarton * item.cartonsCount;
        return [i + 1, item.productName, item.cartonsCount, item.unitsPerCarton,
          item.netWeightPerCarton, item.grossWeightPerCarton,
          item.length, item.width, item.height, item.unitValueUSD, +totalValue.toFixed(2)];
      }),
      [],
      ["الإجماليات", "", t.totalCartons, "", +t.totalNetWeight.toFixed(2), +t.totalGrossWeight.toFixed(2), "", "", "", "", +t.totalValueUSD.toFixed(2)],
      ["إجمالي CBM:", +t.totalCBM.toFixed(3)],
    ];

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 5 }, { wch: 28 }, { wch: 12 }, { wch: 12 },
      { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 16 }, { wch: 16 }];
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

// ─── PDF – Shipments Tracker ─────────────────────────────────────────────────

export function exportShipmentsPDF(shipments: Shipment[]) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageW, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("SHIPMENTS TRACKER REPORT  /  تقرير متابعة الشحنات", pageW / 2, 12, { align: "center" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`مستورد الصين  |  China Import Tracker  |  Date: ${todayStr()}  |  Total: ${shipments.length} shipments`, pageW / 2, 21, { align: "center" });

  // Stage summary
  const stages = ["تم الشراء", "في مستودع الصين", "في البحر / الجو", "التخليص الجمركي", "واصل للمستودع"];
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Stage Summary:", 14, 36);

  autoTable(doc, {
    startY: 40,
    head: [["Stage / المرحلة", "Count"]],
    body: stages.map(s => [s, shipments.filter(sh => sh.stage === s).length]),
    theme: "striped",
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: "bold", fontSize: 9 },
    styles: { fontSize: 9, cellPadding: 2.5 },
    tableWidth: 100,
    columnStyles: { 1: { halign: "center" } },
  });

  const afterSummary = (doc as any).lastAutoTable.finalY + 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text("All Shipments:", 14, afterSummary);

  autoTable(doc, {
    startY: afterSummary + 4,
    head: [["#", "Shipment Name", "Product", "Supplier", "Container No.", "Stage / المرحلة", "Last Update", "Notes Count"]],
    body: shipments.map((s, i) => [
      i + 1,
      s.name,
      s.productName,
      s.supplier,
      s.containerNumber || "—",
      s.stage,
      new Date(s.updatedAt).toLocaleDateString("en-GB"),
      s.notes.length,
    ]),
    theme: "striped",
    headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: "bold", fontSize: 8 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    styles: { fontSize: 8, cellPadding: 2.5 },
    columnStyles: { 1: { cellWidth: 45 }, 5: { cellWidth: 35 } },
    margin: { left: 14, right: 14 },
  });

  doc.setFontSize(7.5);
  doc.setTextColor(150, 150, 150);
  doc.text("Generated by مستورد الصين  –  China Import Tracker", pageW / 2, pageH - 5, { align: "center" });

  doc.save(`Shipments_${todayStr().replace(/\//g, "-")}.pdf`);
}

// ─── Excel – Shipments Tracker ────────────────────────────────────────────────

export function exportShipmentsExcel(shipments: Shipment[]) {
  const wb = XLSX.utils.book_new();

  // Summary by stage
  const stages = ["تم الشراء", "في مستودع الصين", "في البحر / الجو", "التخليص الجمركي", "واصل للمستودع"];
  const summaryRows: any[][] = [
    ["تقرير متابعة الشحنات  –  Shipments Tracker Report"],
    ["التاريخ:", todayStr(), "", "إجمالي الشحنات:", shipments.length],
    [],
    ["المرحلة / Stage", "عدد الشحنات"],
    ...stages.map(s => [s, shipments.filter(sh => sh.stage === s).length]),
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary["!cols"] = [{ wch: 30 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, "ملخص المراحل");

  // All shipments sheet
  const allRows: any[][] = [
    ["#", "اسم الشحنة", "المنتج", "المورد", "رقم الحاوية", "المرحلة الحالية", "تاريخ الإنشاء", "آخر تحديث", "عدد الملاحظات"],
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

  // Notes sheet
  const noteRows: any[][] = [
    ["اسم الشحنة", "المرحلة", "التاريخ والوقت", "الملاحظة"],
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
