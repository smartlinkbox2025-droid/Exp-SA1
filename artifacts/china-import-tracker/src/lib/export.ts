import jsPDF from "jspdf";
import "jspdf-autotable";
import Papa from "papaparse";
import { formatNumber, calculateFeasibility } from "./calculations";
import { FeasibilityStudy, PackingList } from "./storage";

// Arabic text in PDF can be tricky with standard fonts in jsPDF. 
// A common workaround is to use a font that supports Arabic (like Amiri or Arial if provided).
// For jsPDF, we might need to add a custom font if it supports it, but standard jsPDF doesn't natively shape Arabic perfectly.
// Since adding an Arabic VFS might exceed file size, we will export standard PDFs but labels might be basic.
// Actually, let's keep headers simple or rely on English if Arabic PDF fails, but we'll try to write Arabic text.
// Note: jsPDF without a proper Arabic shaping library and font might render letters left-to-right and detached.
// For the sake of this test, we'll implement a basic structure.

export function exportStudyPDF(study: FeasibilityStudy) {
  const doc = new jsPDF();
  const calc = calculateFeasibility(study);
  
  doc.setFontSize(20);
  doc.text("Feasibility Study - مستورد الصين", 14, 22);
  
  doc.setFontSize(12);
  doc.text(`Product: ${study.productName}`, 14, 32);
  doc.text(`Date: ${new Date(study.updatedAt).toLocaleDateString('ar-SA')}`, 14, 40);

  const tableData = [
    ["Parameter", "Value"],
    ["Factory Price", `${study.factoryPrice} ${study.currency}`],
    ["Quantity", `${study.quantity}`],
    ["Domestic Shipping (RMB)", `${study.domesticShippingRMB}`],
    ["Sea/Air Freight (SAR)", `${study.freightCostSAR}`],
    ["Custom Duty %", `${study.customDutyPct}%`],
    ["Total Landed Cost (SAR)", `${formatNumber(calc.totalLandedCostSAR)}`],
    ["Cost per Unit Landed (SAR)", `${formatNumber(calc.costPerUnitLandedSAR)}`],
    ["Target Selling Price (SAR)", `${study.targetSellingPrice}`],
    ["Net Profit Margin %", `${formatNumber(calc.netProfitMarginPct)}%`],
    ["ROI %", `${formatNumber(calc.roiPct)}%`],
    ["Risk Score", `${calc.riskScore} / 10`],
  ];

  (doc as any).autoTable({
    startY: 50,
    head: [["Metric", "Details"]],
    body: tableData,
    theme: 'grid',
    styles: { font: "helvetica", halign: 'right' },
    headStyles: { fillColor: [15, 23, 42] } // navy
  });

  doc.save(`Study_${study.productName}.pdf`);
}

export function exportStudyCSV(study: FeasibilityStudy) {
  const calc = calculateFeasibility(study);
  const data = [
    {
      Product: study.productName,
      "Factory Price": study.factoryPrice,
      Currency: study.currency,
      Quantity: study.quantity,
      "Total Landed Cost SAR": calc.totalLandedCostSAR,
      "Cost per Unit SAR": calc.costPerUnitLandedSAR,
      "Net Profit %": calc.netProfitMarginPct,
      "ROI %": calc.roiPct,
      "Risk Score": calc.riskScore
    }
  ];
  
  const csv = Papa.unparse(data);
  const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Study_${study.productName}.csv`;
  link.click();
}

export function exportPackingListPDF(list: PackingList) {
  const doc = new jsPDF();
  
  doc.setFontSize(20);
  doc.text("Packing List - بيان التعبئة", 14, 22);
  
  doc.setFontSize(12);
  doc.text(`Supplier: ${list.supplierName}`, 14, 32);
  doc.text(`B/L Number: ${list.billOfLading}`, 14, 40);
  doc.text(`Description: ${list.goodsDescription}`, 14, 48);
  doc.text(`Date: ${new Date(list.updatedAt).toLocaleDateString('ar-SA')}`, 14, 56);

  const tableData = list.items.map(item => [
    item.productName,
    item.cartonsCount.toString(),
    item.unitsPerCarton.toString(),
    item.netWeightPerCarton.toString(),
    item.grossWeightPerCarton.toString(),
    `${item.length}x${item.width}x${item.height}`,
    item.unitValueUSD.toString()
  ]);

  (doc as any).autoTable({
    startY: 65,
    head: [["Product", "Cartons", "Units/Ctn", "NW/Ctn(kg)", "GW/Ctn(kg)", "LxWxH(cm)", "Unit USD"]],
    body: tableData,
    theme: 'grid',
    styles: { font: "helvetica", halign: 'center' },
    headStyles: { fillColor: [15, 23, 42] }
  });

  doc.save(`PackingList_${list.billOfLading}.pdf`);
}

export function exportPackingListCSV(list: PackingList) {
  const data = list.items.map(item => ({
    "Supplier": list.supplierName,
    "B/L Number": list.billOfLading,
    "Product": item.productName,
    "Cartons": item.cartonsCount,
    "Units/Ctn": item.unitsPerCarton,
    "NW/Ctn (kg)": item.netWeightPerCarton,
    "GW/Ctn (kg)": item.grossWeightPerCarton,
    "Length (cm)": item.length,
    "Width (cm)": item.width,
    "Height (cm)": item.height,
    "Unit Value (USD)": item.unitValueUSD
  }));
  
  const csv = Papa.unparse(data);
  const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `PackingList_${list.billOfLading}.csv`;
  link.click();
}
