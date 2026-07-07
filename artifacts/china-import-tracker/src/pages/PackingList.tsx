import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PackingListSchema, PackingList, PackingListItem } from "@/lib/storage";
import { usePackingLists } from "@/hooks/useLocalStorage";
import { calculatePackingListTotals, formatNumber } from "@/lib/calculations";
import {
  exportPackingListPDF,
  exportPackingListExcel,
  exportMultiPackingListPDF,
  exportMultiPackingListExcel,
} from "@/lib/export";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  PackageCheck, Save, FileText, Download, Trash2, Edit,
  Plus, Box, CheckSquare, Square, FileSpreadsheet,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";

const formSchema = PackingListSchema.omit({ id: true, createdAt: true, updatedAt: true });
type FormData = z.infer<typeof formSchema>;

const defaultValues: FormData = {
  supplierName: "",
  billOfLading: "",
  goodsDescription: "",
  items: [
    {
      id: "temp-1",
      productName: "",
      cartonsCount: 1,
      unitsPerCarton: 1,
      netWeightPerCarton: 0,
      grossWeightPerCarton: 0,
      length: 0,
      width: 0,
      height: 0,
      unitValueUSD: 0,
    },
  ],
};

export default function PackingListManager() {
  const { packingLists, saveList, deleteList } = usePackingLists();
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const watchItems = form.watch("items");
  const totals = calculatePackingListTotals(watchItems as PackingListItem[]);

  const onSubmit = (data: FormData) => {
    const now = Date.now();
    const list: PackingList = {
      ...data,
      id: editingId || `pl-${now}`,
      createdAt: editingId
        ? packingLists.find((l) => l.id === editingId)?.createdAt || now
        : now,
      updatedAt: now,
    };
    saveList(list);
    toast({
      title: "تم الحفظ بنجاح",
      description: `تم حفظ بيان التعبئة للبوليصة ${data.billOfLading}`,
    });
    if (!editingId) form.reset(defaultValues);
  };

  const handleEdit = (list: PackingList) => {
    setEditingId(list.id);
    form.reset(list);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = (id: string) => {
    if (confirm("هل أنت متأكد من حذف هذا البيان؟")) {
      deleteList(id);
      setSelectedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
      if (editingId === id) { setEditingId(null); form.reset(defaultValues); }
      toast({ title: "تم الحذف", description: "تم حذف بيان التعبئة", variant: "destructive" });
    }
  };

  // ── Selection helpers ──────────────────────────────────────────────────────
  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleSelectAll = () =>
    setSelectedIds(
      selectedIds.size === packingLists.length
        ? new Set()
        : new Set(packingLists.map((l) => l.id))
    );

  const selectedLists = packingLists.filter((l) => selectedIds.has(l.id));
  const allSelected = packingLists.length > 0 && selectedIds.size === packingLists.length;
  const someSelected = selectedIds.size > 0;

  const handleMultiPDF = async () => {
    if (!someSelected) return;
    await exportMultiPackingListPDF(selectedLists);
    toast({ title: "تم تصدير PDF", description: `تم تصدير ${selectedLists.length} بيان في ملف واحد` });
  };

  const handleMultiExcel = () => {
    if (!someSelected) return;
    exportMultiPackingListExcel(selectedLists);
    toast({ title: "تم تصدير Excel", description: `تم تصدير ${selectedLists.length} بيان في ملف واحد` });
  };

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <PackageCheck className="w-8 h-8 text-primary" />
          بيان التعبئة (Packing List)
        </h2>
        <p className="text-muted-foreground mt-1">إنشاء وإدارة بيانات التعبئة والمقاسات للشحنات.</p>
      </div>

      <Card className="border-t-4 border-t-primary shadow-md">
        <CardHeader className="bg-muted/30 pb-4">
          <CardTitle className="text-lg flex justify-between items-center">
            <span>{editingId ? "تعديل بيان تعبئة" : "بيان تعبئة جديد"}</span>
            {editingId && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setEditingId(null); form.reset(defaultValues); }}
              >
                إلغاء التعديل
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {/* Header Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>اسم المورد</Label>
                <Input placeholder="مثال: Shenzhen Tech Co." {...form.register("supplierName")} />
              </div>
              <div className="space-y-2">
                <Label>رقم البوليصة (B/L)</Label>
                <Input placeholder="رقم بوليصة الشحن" {...form.register("billOfLading")} />
              </div>
              <div className="space-y-2">
                <Label>وصف البضاعة</Label>
                <Input placeholder="ملحقات إلكترونية" {...form.register("goodsDescription")} />
              </div>
            </div>

            {/* Line Items */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="font-semibold text-primary">الأصناف والتعبئة</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2 text-primary"
                  onClick={() =>
                    append({
                      id: `temp-${Date.now()}`,
                      productName: "",
                      cartonsCount: 1,
                      unitsPerCarton: 1,
                      netWeightPerCarton: 0,
                      grossWeightPerCarton: 0,
                      length: 0,
                      width: 0,
                      height: 0,
                      unitValueUSD: 0,
                    })
                  }
                >
                  <Plus className="w-4 h-4" /> إضافة صنف
                </Button>
              </div>

              <div className="space-y-6">
                {fields.map((field, index) => (
                  <div key={field.id} className="p-4 bg-muted/20 border rounded-lg relative">
                    <div className="absolute top-2 left-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => remove(index)}
                        disabled={fields.length === 1}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="mb-4 pr-8">
                      <Label className="text-muted-foreground text-xs mb-1 block">
                        المنتج (الصنف {index + 1})
                      </Label>
                      <Input
                        placeholder="اسم المنتج"
                        {...form.register(`items.${index}.productName`)}
                      />
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">عدد الكراتين</Label>
                        <Input type="number" min="1" step="1" {...form.register(`items.${index}.cartonsCount`, { valueAsNumber: true })} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">قطع/كرتون</Label>
                        <Input type="number" min="1" step="1" {...form.register(`items.${index}.unitsPerCarton`, { valueAsNumber: true })} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">وزن صافي (كج)</Label>
                        <Input type="number" min="0" step="any" {...form.register(`items.${index}.netWeightPerCarton`, { valueAsNumber: true })} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">وزن إجمالي (كج)</Label>
                        <Input type="number" min="0" step="any" {...form.register(`items.${index}.grossWeightPerCarton`, { valueAsNumber: true })} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">طول (سم)</Label>
                        <Input type="number" min="0" step="any" {...form.register(`items.${index}.length`, { valueAsNumber: true })} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">عرض (سم)</Label>
                        <Input type="number" min="0" step="any" {...form.register(`items.${index}.width`, { valueAsNumber: true })} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">ارتفاع (سم)</Label>
                        <Input type="number" min="0" step="any" {...form.register(`items.${index}.height`, { valueAsNumber: true })} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">قيمة الوحدة USD</Label>
                        <Input type="number" min="0" step="any" {...form.register(`items.${index}.unitValueUSD`, { valueAsNumber: true })} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals Banner */}
            <div className="bg-sidebar text-sidebar-foreground p-4 rounded-xl flex flex-wrap gap-6 items-center justify-between shadow-inner">
              <div className="flex items-center gap-6">
                <div>
                  <p className="text-xs text-sidebar-primary mb-1">إجمالي الكراتين</p>
                  <p className="text-xl font-bold">{totals.totalCartons}</p>
                </div>
                <div>
                  <p className="text-xs text-sidebar-primary mb-1">الحجم CBM</p>
                  <p className="text-xl font-bold">{formatNumber(totals.totalCBM, 3)}</p>
                </div>
                <div>
                  <p className="text-xs text-sidebar-primary mb-1">وزن إجمالي GW</p>
                  <p className="text-xl font-bold">{formatNumber(totals.totalGrossWeight, 1)} كج</p>
                </div>
                <div className="hidden md:block">
                  <p className="text-xs text-sidebar-primary mb-1">القيمة الإجمالية</p>
                  <p className="text-xl font-bold">${formatNumber(totals.totalValueUSD, 2)}</p>
                </div>
              </div>

              <Button
                type="submit"
                size="lg"
                className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold gap-2 ml-auto w-full md:w-auto mt-4 md:mt-0"
              >
                <Save className="w-5 h-5" />
                {editingId ? "تحديث البيان" : "حفظ البيان"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* ── Saved Lists ───────────────────────────────────────────────────────── */}
      <div className="space-y-4 pt-8">

        {/* Toolbar row */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
          <h3 className="text-xl font-bold">
            بيانات التعبئة المحفوظة ({packingLists.length})
          </h3>

          {packingLists.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {/* Select-all toggle */}
              <Button
                variant="outline"
                size="sm"
                className="gap-2 text-xs"
                onClick={toggleSelectAll}
              >
                {allSelected ? (
                  <CheckSquare className="w-4 h-4 text-primary" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
                {allSelected ? "إلغاء تحديد الكل" : "تحديد الكل"}
              </Button>

              {/* Bulk export buttons – animated in when something is selected */}
              <AnimatePresence>
                {someSelected && (
                  <motion.div
                    className="flex items-center gap-2"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.18 }}
                  >
                    <span className="text-xs text-muted-foreground font-medium bg-muted px-2 py-1 rounded-full">
                      {selectedIds.size} محدد
                    </span>

                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2 text-blue-600 border-blue-300 hover:bg-blue-50"
                      onClick={handleMultiPDF}
                    >
                      <FileText className="w-4 h-4" />
                      تصدير PDF
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2 text-green-600 border-green-300 hover:bg-green-50"
                      onClick={handleMultiExcel}
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      تصدير Excel
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Cards */}
        {packingLists.length === 0 ? (
          <div className="text-center py-12 bg-muted/20 rounded-xl border border-dashed">
            <Box className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">لا توجد بيانات تعبئة محفوظة.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {packingLists.map((list) => {
              const listTotals = calculatePackingListTotals(list.items);
              const isActive = editingId === list.id;
              const isChecked = selectedIds.has(list.id);

              return (
                <Card
                  key={list.id}
                  className={`transition-all ${
                    isChecked
                      ? "ring-2 ring-primary border-primary bg-primary/5"
                      : isActive
                      ? "ring-2 ring-primary border-primary"
                      : "hover:border-primary/50"
                  }`}
                >
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-base font-bold flex items-start justify-between gap-2">
                      {/* Checkbox */}
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => toggleSelect(list.id)}
                        className="mt-0.5 shrink-0"
                        aria-label={`تحديد ${list.supplierName}`}
                      />

                      <span className="truncate flex-1">{list.supplierName}</span>

                      <span className="text-xs bg-muted px-2 py-1 rounded font-mono font-normal shrink-0">
                        {list.billOfLading || "بدون بوليصة"}
                      </span>
                    </CardTitle>
                    <CardDescription className="text-xs line-clamp-1 pr-6">
                      {list.goodsDescription}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 pt-2">
                    <div className="flex gap-4 text-sm mb-4 bg-muted/50 p-2 rounded">
                      <div>
                        <span className="text-muted-foreground text-xs block">كرتون</span>
                        <span className="font-bold">{listTotals.totalCartons}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs block">CBM</span>
                        <span className="font-bold">{formatNumber(listTotals.totalCBM, 2)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs block">GW (كج)</span>
                        <span className="font-bold">{formatNumber(listTotals.totalGrossWeight, 0)}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 flex-1"
                        onClick={() => handleEdit(list)}
                      >
                        <Edit className="w-3.5 h-3.5 ml-1.5" /> تعديل
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2 text-blue-600"
                        onClick={() => exportPackingListPDF(list).catch(console.error)}
                        title="تصدير PDF"
                      >
                        <FileText className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2 text-green-600"
                        onClick={() => exportPackingListExcel(list)}
                        title="تصدير Excel"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                        onClick={() => handleDelete(list.id)}
                        title="حذف"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
