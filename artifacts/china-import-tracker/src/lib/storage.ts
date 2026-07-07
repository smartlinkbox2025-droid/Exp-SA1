import { z } from "zod";

// --- Enums & Schemas ---

export const CurrencySchema = z.enum(["RMB", "USD", "SAR"]);
export type Currency = z.infer<typeof CurrencySchema>;

export const StageSchema = z.enum([
  "تم الشراء",
  "في مستودع الصين",
  "في البحر / الجو",
  "التخليص الجمركي",
  "واصل للمستودع"
]);
export type Stage = z.infer<typeof StageSchema>;

// --- Feasibility Study ---

export const FeasibilityStudySchema = z.object({
  id: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
  
  productName: z.string(),
  currency: CurrencySchema,
  factoryPrice: z.number(),
  quantity: z.number(),
  
  cartonLength: z.number(),
  cartonWidth: z.number(),
  cartonHeight: z.number(),
  grossWeight: z.number(),
  unitsPerCarton: z.number(),
  
  domesticShippingRMB: z.number(),
  freightCostSAR: z.number(),
  customDutyPct: z.number(),
  vatPct: z.number().default(15),
  clearanceFeeSAR: z.number(),
  localLogisticsSAR: z.number(),
  certificationFeeSAR: z.number(),
  
  targetSellingPrice: z.number()
});
export type FeasibilityStudy = z.infer<typeof FeasibilityStudySchema>;

// --- Shipment ---

export const ShipmentNoteSchema = z.object({
  id: z.string(),
  timestamp: z.number(),
  content: z.string()
});
export type ShipmentNote = z.infer<typeof ShipmentNoteSchema>;

export const ShipmentSchema = z.object({
  id: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
  
  name: z.string(),
  productName: z.string(),
  supplier: z.string(),
  containerNumber: z.string().optional(),
  purchaseDate: z.number(),
  stage: StageSchema,
  notes: z.array(ShipmentNoteSchema)
});
export type Shipment = z.infer<typeof ShipmentSchema>;

// --- Packing List ---

export const PackingListItemSchema = z.object({
  id: z.string(),
  productName: z.string(),
  cartonsCount: z.number(),
  unitsPerCarton: z.number(),
  netWeightPerCarton: z.number(),
  grossWeightPerCarton: z.number(),
  length: z.number(),
  width: z.number(),
  height: z.number(),
  unitValueUSD: z.number(),
});
export type PackingListItem = z.infer<typeof PackingListItemSchema>;

export const PackingListSchema = z.object({
  id: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
  
  supplierName: z.string(),
  billOfLading: z.string(),
  goodsDescription: z.string(),
  items: z.array(PackingListItemSchema)
});
export type PackingList = z.infer<typeof PackingListSchema>;

// --- Store Types ---

export type AppData = {
  studies: FeasibilityStudy[];
  shipments: Shipment[];
  packingLists: PackingList[];
  hasSeeded: boolean;
};

// --- Storage Utils ---

const STORAGE_KEY = "china_import_tracker_data";

const defaultData: AppData = {
  studies: [],
  shipments: [],
  packingLists: [],
  hasSeeded: false
};

export function getStorageData(): AppData {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : defaultData;
  } catch (err) {
    console.error("Failed to parse localStorage", err);
    return defaultData;
  }
}

export function saveStorageData(data: AppData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error("Failed to save to localStorage", err);
  }
}
