import { FeasibilityStudy, PackingList, PackingListItem } from "./storage";

export const RATES = {
  USD_TO_SAR: 3.75,
  RMB_TO_SAR: 0.52,
};

export function convertToSAR(amount: number, currency: string): number {
  if (currency === "USD") return amount * RATES.USD_TO_SAR;
  if (currency === "RMB") return amount * RATES.RMB_TO_SAR;
  return amount; // Already SAR
}

export interface CalculatedStudy {
  totalLandedCostSAR: number;
  costPerUnitLandedSAR: number;
  netProfitSAR: number;
  netProfitPerUnitSAR: number;
  netProfitMarginPct: number;
  roiPct: number;
  riskScore: number;
  recommendedMinPriceSAR: number;
  totalCBM: number;
  totalCartons: number;
}

export function calculateFeasibility(study: Partial<FeasibilityStudy>): CalculatedStudy {
  const {
    factoryPrice = 0,
    currency = "RMB",
    quantity = 0,
    unitsPerCarton = 1,
    cartonLength = 0,
    cartonWidth = 0,
    cartonHeight = 0,
    domesticShippingRMB = 0,
    freightCostSAR = 0,
    customDutyPct = 0,
    vatPct = 15,
    clearanceFeeSAR = 0,
    localLogisticsSAR = 0,
    certificationFeeSAR = 0,
    targetSellingPrice = 0
  } = study;

  const totalCartons = unitsPerCarton > 0 ? Math.ceil(quantity / unitsPerCarton) : 0;
  
  // Volume in CBM (cm to m^3)
  const cartonCBM = (cartonLength * cartonWidth * cartonHeight) / 1000000;
  const totalCBM = totalCartons * cartonCBM;

  const factoryCostSAR = convertToSAR(factoryPrice * quantity, currency);
  const domesticShippingSAR = convertToSAR(domesticShippingRMB, "RMB");

  // CIF Value = Factory Cost + Domestic + Freight
  const cifValueSAR = factoryCostSAR + domesticShippingSAR + freightCostSAR;

  // Customs Duty = CIF * Duty%
  const customDutySAR = cifValueSAR * (customDutyPct / 100);

  // VAT = (CIF + Duty + Clearance) * 15% 
  // (In KSA, VAT is applied to landed cost at port including duties and some fees)
  const baseForVatSAR = cifValueSAR + customDutySAR + clearanceFeeSAR;
  const vatSAR = baseForVatSAR * (vatPct / 100);

  // Total Landed Cost
  const totalLandedCostSAR = 
    cifValueSAR + 
    customDutySAR + 
    vatSAR + 
    clearanceFeeSAR + 
    localLogisticsSAR + 
    certificationFeeSAR;

  const costPerUnitLandedSAR = quantity > 0 ? totalLandedCostSAR / quantity : 0;
  
  const recommendedMinPriceSAR = costPerUnitLandedSAR * 1.3;

  const expectedRevenueSAR = targetSellingPrice * quantity;
  const netProfitSAR = expectedRevenueSAR - totalLandedCostSAR;
  const netProfitMarginPct = expectedRevenueSAR > 0 ? (netProfitSAR / expectedRevenueSAR) * 100 : 0;
  
  const roiPct = totalLandedCostSAR > 0 ? (netProfitSAR / totalLandedCostSAR) * 100 : 0;

  // Simple Risk Scoring (1 to 10)
  // Higher duty, high fees vs low volume, poor ROI increases risk
  let riskScore = 1;
  if (customDutyPct > 10) riskScore += 2;
  if (certificationFeeSAR > 2000 && quantity < 1000) riskScore += 2;
  if (freightCostSAR > factoryCostSAR) riskScore += 3;
  if (roiPct < 20) riskScore += 2;
  if (roiPct > 50) riskScore -= 1;
  if (totalLandedCostSAR === 0) riskScore = 0; // Not calculated yet

  riskScore = Math.max(1, Math.min(10, riskScore));

  const netProfitPerUnitSAR = quantity > 0 ? netProfitSAR / quantity : 0;

  return {
    totalLandedCostSAR,
    costPerUnitLandedSAR,
    netProfitSAR,
    netProfitPerUnitSAR,
    netProfitMarginPct,
    roiPct,
    riskScore,
    recommendedMinPriceSAR,
    totalCBM,
    totalCartons
  };
}

export function formatNumber(num: number, decimals: number = 2): string {
  return num.toLocaleString('ar-SA', { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
}

export function calculatePackingListTotals(items: PackingListItem[]) {
  return items.reduce((acc, item) => {
    const cbm = (item.length * item.width * item.height * item.cartonsCount) / 1000000;
    return {
      totalCartons: acc.totalCartons + item.cartonsCount,
      totalNetWeight: acc.totalNetWeight + (item.netWeightPerCarton * item.cartonsCount),
      totalGrossWeight: acc.totalGrossWeight + (item.grossWeightPerCarton * item.cartonsCount),
      totalCBM: acc.totalCBM + cbm,
      totalValueUSD: acc.totalValueUSD + (item.unitValueUSD * item.unitsPerCarton * item.cartonsCount)
    };
  }, { totalCartons: 0, totalNetWeight: 0, totalGrossWeight: 0, totalCBM: 0, totalValueUSD: 0 });
}
