import { AppData } from "./storage";

export const seedData: AppData = {
  hasSeeded: true,
  studies: [
    {
      id: "study-1",
      createdAt: Date.now() - 86400000 * 2,
      updatedAt: Date.now() - 86400000 * 2,
      productName: "جوارب قطنية رجالية",
      currency: "RMB",
      factoryPrice: 8,
      quantity: 1000,
      cartonLength: 50,
      cartonWidth: 40,
      cartonHeight: 40,
      grossWeight: 15,
      unitsPerCarton: 100,
      domesticShippingRMB: 300,
      freightCostSAR: 1500,
      customDutyPct: 5,
      vatPct: 15,
      clearanceFeeSAR: 500,
      localLogisticsSAR: 300,
      certificationFeeSAR: 1500,
      targetSellingPrice: 25
    },
    {
      id: "study-2",
      createdAt: Date.now() - 86400000 * 5,
      updatedAt: Date.now() - 86400000 * 1,
      productName: "سماعات بلوتوث رياضية",
      currency: "USD",
      factoryPrice: 12,
      quantity: 500,
      cartonLength: 60,
      cartonWidth: 30,
      cartonHeight: 30,
      grossWeight: 12,
      unitsPerCarton: 50,
      domesticShippingRMB: 500,
      freightCostSAR: 800,
      customDutyPct: 10,
      vatPct: 15,
      clearanceFeeSAR: 600,
      localLogisticsSAR: 250,
      certificationFeeSAR: 2500,
      targetSellingPrice: 120
    }
  ],
  shipments: [
    {
      id: "ship-1",
      createdAt: Date.now() - 86400000 * 10,
      updatedAt: Date.now() - 86400000 * 2,
      name: "شحنة الجوارب #001",
      productName: "جوارب قطنية",
      supplier: "Yiwu Socks Factory",
      containerNumber: "TCKU1234567",
      purchaseDate: Date.now() - 86400000 * 10,
      stage: "في البحر / الجو",
      notes: [
        { id: "n1", timestamp: Date.now() - 86400000 * 8, content: "تم الاستلام في مستودع ايوو" },
        { id: "n2", timestamp: Date.now() - 86400000 * 2, content: "تم الشحن على باخرة COSCO" }
      ]
    },
    {
      id: "ship-2",
      createdAt: Date.now() - 86400000 * 20,
      updatedAt: Date.now() - 86400000 * 1,
      name: "شحنة الإلكترونيات #002",
      productName: "سماعات وشواحن",
      supplier: "Shenzhen Tech",
      containerNumber: "MSKU9988776",
      purchaseDate: Date.now() - 86400000 * 20,
      stage: "التخليص الجمركي",
      notes: [
        { id: "n3", timestamp: Date.now() - 86400000 * 1, content: "وصلت الميناء، بانتظار البيان الجمركي" }
      ]
    }
  ],
  packingLists: [
    {
      id: "pl-1",
      createdAt: Date.now() - 86400000 * 3,
      updatedAt: Date.now() - 86400000 * 3,
      supplierName: "Guangzhou Electronics Co.",
      billOfLading: "BL-GZ-2023-001",
      goodsDescription: "ملحقات جوالات",
      items: [
        {
          id: "pli-1",
          productName: "كفرات ايفون 14",
          cartonsCount: 20,
          unitsPerCarton: 100,
          netWeightPerCarton: 10,
          grossWeightPerCarton: 11,
          length: 50,
          width: 40,
          height: 30,
          unitValueUSD: 1.5
        },
        {
          id: "pli-2",
          productName: "شواحن 20 واط",
          cartonsCount: 10,
          unitsPerCarton: 50,
          netWeightPerCarton: 8,
          grossWeightPerCarton: 9,
          length: 45,
          width: 35,
          height: 35,
          unitValueUSD: 4.0
        }
      ]
    }
  ]
};

export function seedIfNeeded() {
  const data = localStorage.getItem("china_import_tracker_data");
  if (!data) {
    localStorage.setItem("china_import_tracker_data", JSON.stringify(seedData));
  } else {
    try {
      const parsed = JSON.parse(data);
      if (!parsed.hasSeeded) {
        localStorage.setItem("china_import_tracker_data", JSON.stringify({ ...seedData, studies: [...seedData.studies, ...parsed.studies], shipments: [...seedData.shipments, ...parsed.shipments], packingLists: [...seedData.packingLists, ...parsed.packingLists] }));
      }
    } catch(e) {
      localStorage.setItem("china_import_tracker_data", JSON.stringify(seedData));
    }
  }
}
