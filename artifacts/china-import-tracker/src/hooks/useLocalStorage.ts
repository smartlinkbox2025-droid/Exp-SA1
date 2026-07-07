import { useState, useEffect, useCallback } from "react";
import { getStorageData, saveStorageData, AppData } from "../lib/storage";

export function useAppStorage() {
  const [data, setData] = useState<AppData>(getStorageData());

  // Listen for changes in other tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "china_import_tracker_data") {
        setData(getStorageData());
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const updateData = useCallback((updater: (prev: AppData) => AppData) => {
    setData((prev) => {
      const next = updater(prev);
      saveStorageData(next);
      return next;
    });
  }, []);

  return {
    data,
    updateData
  };
}

export function useFeasibilityStudies() {
  const { data, updateData } = useAppStorage();
  
  const saveStudy = useCallback((study: any) => {
    updateData(prev => {
      const exists = prev.studies.findIndex(s => s.id === study.id);
      if (exists >= 0) {
        const newStudies = [...prev.studies];
        newStudies[exists] = study;
        return { ...prev, studies: newStudies };
      }
      return { ...prev, studies: [study, ...prev.studies] };
    });
  }, [updateData]);

  const deleteStudy = useCallback((id: string) => {
    updateData(prev => ({
      ...prev,
      studies: prev.studies.filter(s => s.id !== id)
    }));
  }, [updateData]);

  return {
    studies: data.studies,
    saveStudy,
    deleteStudy
  };
}

export function useShipments() {
  const { data, updateData } = useAppStorage();
  
  const saveShipment = useCallback((shipment: any) => {
    updateData(prev => {
      const exists = prev.shipments.findIndex(s => s.id === shipment.id);
      if (exists >= 0) {
        const newShipments = [...prev.shipments];
        newShipments[exists] = shipment;
        return { ...prev, shipments: newShipments };
      }
      return { ...prev, shipments: [shipment, ...prev.shipments] };
    });
  }, [updateData]);

  const deleteShipment = useCallback((id: string) => {
    updateData(prev => ({
      ...prev,
      shipments: prev.shipments.filter(s => s.id !== id)
    }));
  }, [updateData]);

  return {
    shipments: data.shipments,
    saveShipment,
    deleteShipment
  };
}

export function usePackingLists() {
  const { data, updateData } = useAppStorage();
  
  const saveList = useCallback((list: any) => {
    updateData(prev => {
      const exists = prev.packingLists.findIndex(s => s.id === list.id);
      if (exists >= 0) {
        const newLists = [...prev.packingLists];
        newLists[exists] = list;
        return { ...prev, packingLists: newLists };
      }
      return { ...prev, packingLists: [list, ...prev.packingLists] };
    });
  }, [updateData]);

  const deleteList = useCallback((id: string) => {
    updateData(prev => ({
      ...prev,
      packingLists: prev.packingLists.filter(s => s.id !== id)
    }));
  }, [updateData]);

  return {
    packingLists: data.packingLists,
    saveList,
    deleteList
  };
}
