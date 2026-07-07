import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FeasibilityStudySchema, FeasibilityStudy, Currency } from "@/lib/storage";
import { useFeasibilityStudies } from "@/hooks/useLocalStorage";
import { calculateFeasibility, formatNumber, RATES } from "@/lib/calculations";
import {
  exportStudyPDF, exportStudyExcel,
  exportMultiStudyPDF, exportMultiStudyExcel,
} from "@/lib/export";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Calculator as CalcIcon, Save, FileText, Download, Trash2, Copy,
  Edit, CheckSquare, Square, FileSpreadsheet,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { motion, AnimatePresence } from "framer-motion";

const formSchema = FeasibilityStudySchema.omit({ id: true, createdAt: true, updatedAt: true });
type FormData = z.infer<typeof formSchema>;

const defaultValues: FormData = {
  productName: "",
  currency: "RMB",
  factoryPrice: 0,
  quantity: 0,
  cartonLength: 0,
  cartonWidth: 0,
  cartonHeight: 0,
  grossWeight: 0,
  unitsPerCarton: 1,
  domesticShippingRMB: 0,
  freightCostSAR: 0,
  customDutyPct: 5,
  vatPct: 15,
  clearanceFeeSAR: 0,
  localLogisticsSAR: 0,
  certificationFeeSAR: 0,
  targetSellingPrice: 0,
};

export default function Calculator() {
  const { studies, saveStudy, deleteStudy } = useFeasibilityStudies();
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  const watchAll = form.watch();
  const calculated = calculateFeasibility(watchAll as Partial<FeasibilityStudy>);

  const onSubmit = (data: FormData) => {
    const now = Date.now();
    const study: FeasibilityStudy = {
      ...data,
      id: editingId || `study-${now}`,
      createdAt: editingId ? (studies.find((s) => s.id === editingId)?.createdAt || now) : now,
      updatedAt: now,
    };
    saveStudy(study);
    toast({ title: "تم الحفظ بنجاح", description: `تم حفظ دراسة الجدوى لـ ${data.productName}` });
    if (!editingId) form.reset(defaultValues);
  };

  const handleEdit = (study: FeasibilityStudy) => {
    setEditingId(study.id);
    form.reset(study);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDuplicate = (study: FeasibilityStudy) => {
    const { id, createdAt, updatedAt, ...rest } = study;
    const now = Date.now();
    saveStudy({ ...rest, productName: `${rest.productName} (نسخة)`, id: `study-${now}`, createdAt: now, updatedAt: now });
    toast({ title: "تم التكرار", description: "تم إنشاء نسخة من دراسة الجدوى" });
  };

  const handleDelete = (id: string) => {
    if (confirm("هل أنت متأكد من حذف هذه الدراسة؟")) {
      deleteStudy(id);
      setSelectedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
      if (editingId === id) { setEditingId(null); form.reset(defaultValues); }
      toast({ title: "تم الحذف", description: "تم حذف دراسة الجدوى", variant: "destructive" });
    }
  };

  // ── Selection helpers ──────────────────────────────────────────────────────
  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const toggleSelectAll = () =>
    setSelectedIds(selectedIds.size === studies.length ? new Set() : new Set(studies.map((s) => s.id)));

  const selectedStudies = studies.filter((s) => selectedIds.has(s.id));
  const allSelected = studies.length > 0 && selectedIds.size === studies.length;
  const someSelected = selectedIds.size > 0;

  const handleMultiPDF = async () => {
    await exportMultiStudyPDF(selectedStudies);
    toast({ title: "تم تصدير PDF", description: `تم تصدير ${selectedStudies.length} دراسة في ملف واحد` });
  };
  const handleMultiExcel = () => {
    exportMultiStudyExcel(selectedStudies);
    toast({ title: "تم تصدير Excel", description: `تم تصدير ${selectedStudies.length} دراسة في ملف واحد` });
  };

  const riskLabel =
    calculated.riskScore <= 3 ? "منخفضة" : calculated.riskScore <= 6 ? "متوسطة" : "عالية";

  const profitPositive = calculated.netProfitSAR >= 0;

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <CalcIcon className="w-8 h-8 text-primary" />
          حاسبة الجدوى
        </h2>
        <p className="text-muted-foreground mt-1">حساب تكاليف الاستيراد، الرسوم الجمركية، وهامش الربح المتوقع.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">

        {/* Form Column */}
        <div className="xl:col-span-8 space-y-6">
          <Card className="border-t-4 border-t-primary shadow-md">
            <CardHeader className="bg-muted/30 pb-4">
              <CardTitle className="text-lg flex justify-between items-center">
                <span>{editingId ? "تعديل دراسة الجدوى" : "دراسة جدوى جديدة"}</span>
                {editingId && (
                  <Button variant="ghost" size="sm" onClick={() => { setEditingId(null); form.reset(defaultValues); }}>
                    إلغاء التعديل
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

                {/* Product Info */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-primary border-b pb-2">معلومات المنتج الأساسية</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>اسم المنتج</Label>
                      <Input placeholder="مثال: أكواب ورقية" {...form.register("productName")} />
                    </div>
                    <div className="space-y-2">
                      <Label>الكمية المطلوبة</Label>
                      <Input type="number" min="0" step="any" {...form.register("quantity", { valueAsNumber: true })} />
                    </div>
                    <div className="space-y-2">
                      <Label>عملة الشراء</Label>
                      <Select value={form.watch("currency")} onValueChange={(val: Currency) => form.setValue("currency", val)}>
                        <SelectTrigger><SelectValue placeholder="اختر العملة" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="RMB">RMB (يوان صيني) - {RATES.RMB_TO_SAR} ر.س</SelectItem>
                          <SelectItem value="USD">USD (دولار أمريكي) - {RATES.USD_TO_SAR} ر.س</SelectItem>
                          <SelectItem value="SAR">SAR (ريال سعودي)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>سعر المصنع (للوحدة)</Label>
                      <Input type="number" min="0" step="any" {...form.register("factoryPrice", { valueAsNumber: true })} />
                    </div>
                  </div>
                </div>

                {/* Carton & Weight */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-primary border-b pb-2">أبعاد الكرتون والوزن</h3>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="space-y-2">
                      <Label>طول (سم)</Label>
                      <Input type="number" min="0" step="any" {...form.register("cartonLength", { valueAsNumber: true })} />
                    </div>
                    <div className="space-y-2">
                      <Label>عرض (سم)</Label>
                      <Input type="number" min="0" step="any" {...form.register("cartonWidth", { valueAsNumber: true })} />
                    </div>
                    <div className="space-y-2">
                      <Label>ارتفاع (سم)</Label>
                      <Input type="number" min="0" step="any" {...form.register("cartonHeight", { valueAsNumber: true })} />
                    </div>
                    <div className="space-y-2">
                      <Label>وزن إجمالي (كج)</Label>
                      <Input type="number" min="0" step="any" {...form.register("grossWeight", { valueAsNumber: true })} />
                    </div>
                    <div className="space-y-2 col-span-2 md:col-span-1">
                      <Label>عدد القطع/كرتون</Label>
                      <Input type="number" min="1" step="any" {...form.register("unitsPerCarton", { valueAsNumber: true })} />
                    </div>
                  </div>
                </div>

                {/* Shipping & Logistics */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-primary border-b pb-2">الشحن واللوجستيات</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>شحن داخلي في الصين (RMB الإجمالي)</Label>
                      <Input type="number" min="0" step="any" {...form.register("domesticShippingRMB", { valueAsNumber: true })} />
                    </div>
                    <div className="space-y-2">
                      <Label>تكلفة الشحن البحري/الجوي (SAR الإجمالي)</Label>
                      <Input type="number" min="0" step="any" {...form.register("freightCostSAR", { valueAsNumber: true })} />
                    </div>
                  </div>
                </div>

                {/* Customs & Fees */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-primary border-b pb-2">الجمارك والرسوم</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>الرسوم الجمركية %</Label>
                      <Input type="number" min="0" step="any" {...form.register("customDutyPct", { valueAsNumber: true })} />
                    </div>
                    <div className="space-y-2">
                      <Label>ضريبة القيمة المضافة %</Label>
                      <Input type="number" min="0" step="any" {...form.register("vatPct", { valueAsNumber: true })} />
                    </div>
                    <div className="space-y-2">
                      <Label>أجور التخليص الجمركي (SAR)</Label>
                      <Input type="number" min="0" step="any" {...form.register("clearanceFeeSAR", { valueAsNumber: true })} />
                    </div>
                    <div className="space-y-2">
                      <Label>شهادة سابر / SFDA (SAR)</Label>
                      <Input type="number" min="0" step="any" {...form.register("certificationFeeSAR", { valueAsNumber: true })} />
                    </div>
                    <div className="space-y-2">
                      <Label>الشحن الداخلي للمستودع (SAR)</Label>
                      <Input type="number" min="0" step="any" {...form.register("localLogisticsSAR", { valueAsNumber: true })} />
                    </div>
                    <div className="space-y-2">
                      <Label>سعر البيع المستهدف للوحدة (SAR)</Label>
                      <Input type="number" min="0" step="any" className="border-primary" {...form.register("targetSellingPrice", { valueAsNumber: true })} />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button type="submit" size="lg" className="w-full md:w-auto font-bold gap-2">
                    <Save className="w-5 h-5" />
                    {editingId ? "تحديث الدراسة" : "حفظ الدراسة"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Results Column */}
        <div className="xl:col-span-4 space-y-6">
          <div className="sticky top-24 space-y-6">
            <Card className="bg-sidebar text-sidebar-foreground border-none shadow-xl overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-bl-full -z-10" />
              <CardHeader className="pb-2">
                <CardTitle className="text-xl">النتائج الفورية</CardTitle>
                <CardDescription className="text-sidebar-foreground/70">حسابات التكلفة والأرباح</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 pt-4">

                {/* Total landed cost */}
                <div className="space-y-1">
                  <p className="text-sm text-sidebar-foreground/80">إجمالي التكلفة الواصلة</p>
                  <p className="text-3xl font-bold text-white">
                    {formatNumber(calculated.totalLandedCostSAR)}{" "}
                    <span className="text-sm font-normal text-sidebar-primary">ر.س</span>
                  </p>
                </div>

                {/* Cost/unit + min price */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1 bg-sidebar-accent/50 p-3 rounded-lg">
                    <p className="text-xs text-sidebar-foreground/70">التكلفة للوحدة</p>
                    <p className="text-lg font-bold">{formatNumber(calculated.costPerUnitLandedSAR)} <span className="text-xs">ر.س</span></p>
                  </div>
                  <div className="space-y-1 bg-sidebar-accent/50 p-3 rounded-lg">
                    <p className="text-xs text-sidebar-foreground/70">السعر المقترح</p>
                    <p className="text-lg font-bold text-sidebar-primary">{formatNumber(calculated.recommendedMinPriceSAR)} <span className="text-xs">ر.س</span></p>
                  </div>
                </div>

                {/* ── Profit in SAR ── */}
                <div className={`rounded-lg p-3 border ${profitPositive ? "bg-green-500/10 border-green-500/30" : "bg-red-500/10 border-red-500/30"}`}>
                  <p className="text-xs text-sidebar-foreground/70 mb-2">الربح بالريال السعودي</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] text-sidebar-foreground/60 mb-0.5">إجمالي الربح</p>
                      <p className={`text-lg font-bold ${profitPositive ? "text-green-400" : "text-red-400"}`}>
                        {formatNumber(calculated.netProfitSAR)}{" "}
                        <span className="text-xs font-normal">ر.س</span>
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-sidebar-foreground/60 mb-0.5">ربح الوحدة</p>
                      <p className={`text-lg font-bold ${profitPositive ? "text-green-400" : "text-red-400"}`}>
                        {formatNumber(calculated.netProfitPerUnitSAR)}{" "}
                        <span className="text-xs font-normal">ر.س</span>
                      </p>
                    </div>
                  </div>
                </div>

                <Separator className="bg-sidebar-border" />

                {/* Margin + ROI */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-sidebar-foreground/70">هامش الربح</p>
                    <p className={`text-xl font-bold ${calculated.netProfitMarginPct > 0 ? "text-green-400" : calculated.netProfitMarginPct < 0 ? "text-red-400" : ""}`}>
                      {formatNumber(calculated.netProfitMarginPct, 1)}%
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-sidebar-foreground/70">العائد (ROI)</p>
                    <p className={`text-xl font-bold ${calculated.roiPct > 0 ? "text-green-400" : calculated.roiPct < 0 ? "text-red-400" : ""}`}>
                      {formatNumber(calculated.roiPct, 1)}%
                    </p>
                  </div>
                </div>

                <Separator className="bg-sidebar-border" />

                {/* CBM / Cartons / Risk */}
                <div className="grid grid-cols-3 gap-2 text-center text-sm">
                  <div>
                    <p className="text-xs text-sidebar-foreground/60 mb-1">CBM إجمالي</p>
                    <p className="font-bold">{formatNumber(calculated.totalCBM, 2)}</p>
                  </div>
                  <div className="border-r border-l border-sidebar-border">
                    <p className="text-xs text-sidebar-foreground/60 mb-1">كرتون إجمالي</p>
                    <p className="font-bold">{formatNumber(calculated.totalCartons, 0)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-sidebar-foreground/60 mb-1">المخاطرة</p>
                    <div className={`mx-auto w-fit px-2 py-0.5 rounded text-xs font-bold ${
                      calculated.riskScore <= 3 ? "bg-green-500/20 text-green-400" :
                      calculated.riskScore <= 6 ? "bg-yellow-500/20 text-yellow-400" :
                      "bg-red-500/20 text-red-400"
                    }`}>
                      {riskLabel} ({calculated.riskScore}/10)
                    </div>
                  </div>
                </div>

                {watchAll.productName && !editingId && (
                  <Button
                    className="w-full mt-2 gap-2 bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90"
                    onClick={() => form.handleSubmit(onSubmit)()}
                  >
                    <Save className="w-4 h-4" /> حفظ الدراسة
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

      </div>

      {/* ── Saved Studies ──────────────────────────────────────────────────────── */}
      <div className="space-y-4 pt-8">

        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
          <h3 className="text-xl font-bold">الدراسات المحفوظة ({studies.length})</h3>

          {studies.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={toggleSelectAll}>
                {allSelected ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
                {allSelected ? "إلغاء تحديد الكل" : "تحديد الكل"}
              </Button>

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
                    <Button size="sm" variant="outline" className="gap-2 text-blue-600 border-blue-300 hover:bg-blue-50" onClick={handleMultiPDF}>
                      <FileText className="w-4 h-4" /> تصدير PDF
                    </Button>
                    <Button size="sm" variant="outline" className="gap-2 text-green-600 border-green-300 hover:bg-green-50" onClick={handleMultiExcel}>
                      <FileSpreadsheet className="w-4 h-4" /> تصدير Excel
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Cards */}
        {studies.length === 0 ? (
          <div className="text-center py-12 bg-muted/20 rounded-xl border border-dashed">
            <CalcIcon className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">لا توجد دراسات محفوظة بعد. قم بحفظ دراسة جديدة لتظهر هنا.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {studies.map((study) => {
              const calc = calculateFeasibility(study);
              const isActive = editingId === study.id;
              const isChecked = selectedIds.has(study.id);
              const profit = calc.netProfitSAR;

              return (
                <Card
                  key={study.id}
                  className={`transition-all ${
                    isChecked ? "ring-2 ring-primary border-primary bg-primary/5" :
                    isActive ? "ring-2 ring-primary border-primary" :
                    "hover:border-primary/50"
                  }`}
                >
                  <CardHeader className="p-4 pb-2 flex flex-row items-start justify-between space-y-0 gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => toggleSelect(study.id)}
                        className="mt-0.5 shrink-0"
                      />
                      <div className="min-w-0">
                        <CardTitle className="text-base font-bold line-clamp-1" title={study.productName}>
                          {study.productName}
                        </CardTitle>
                        <CardDescription className="text-xs mt-1">
                          {new Date(study.updatedAt).toLocaleDateString("ar-SA")}
                        </CardDescription>
                      </div>
                    </div>
                    <div className={`shrink-0 px-2 py-1 rounded text-xs font-bold ${
                      calc.riskScore <= 3 ? "bg-green-100 text-green-700" :
                      calc.riskScore <= 6 ? "bg-yellow-100 text-yellow-700" :
                      "bg-red-100 text-red-700"
                    }`}>
                      مخاطرة {calc.riskScore}/10
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-2">
                    <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                      <div className="bg-muted p-2 rounded">
                        <p className="text-muted-foreground text-xs">ROI</p>
                        <p className="font-bold text-green-600">{formatNumber(calc.roiPct, 1)}%</p>
                      </div>
                      <div className="bg-muted p-2 rounded">
                        <p className="text-muted-foreground text-xs">تكلفة الوحدة</p>
                        <p className="font-bold">{formatNumber(calc.costPerUnitLandedSAR, 2)} <span className="text-[10px]">ر.س</span></p>
                      </div>
                    </div>

                    {/* Profit row */}
                    <div className={`flex items-center justify-between px-2 py-1.5 rounded text-xs mb-3 ${profit >= 0 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                      <span>الربح الإجمالي:</span>
                      <span className="font-bold">{formatNumber(profit, 0)} ر.س</span>
                    </div>

                    <div className="flex flex-wrap gap-2 justify-end">
                      <Button variant="outline" size="sm" className="h-8 flex-1" onClick={() => handleEdit(study)}>
                        <Edit className="w-3.5 h-3.5 ml-1.5" /> تعديل
                      </Button>
                      <Button variant="outline" size="sm" className="h-8 px-2" onClick={() => handleDuplicate(study)} title="تكرار">
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="outline" size="sm" className="h-8 px-2 text-blue-600" onClick={() => exportStudyPDF(study).catch(console.error)} title="تصدير PDF">
                        <FileText className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="outline" size="sm" className="h-8 px-2 text-green-600" onClick={() => exportStudyExcel(study)} title="تصدير Excel">
                        <Download className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="outline" size="sm" className="h-8 px-2 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => handleDelete(study.id)} title="حذف">
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
