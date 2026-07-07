import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ShipmentSchema, Shipment, Stage, ShipmentNote } from "@/lib/storage";
import { useShipments } from "@/hooks/useLocalStorage";
import { exportShipmentsPDF, exportShipmentsExcel } from "@/lib/export";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Ship, Plus, ArrowLeft, Clock, MessageSquare, Save, MapPin, FileText, FileSpreadsheet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { format } from "date-fns";

const STAGES: Stage[] = [
  "تم الشراء",
  "في مستودع الصين",
  "في البحر / الجو",
  "التخليص الجمركي",
  "واصل للمستودع",
];

const newShipmentSchema = z.object({
  name: z.string().min(1, "الاسم مطلوب"),
  productName: z.string().min(1, "المنتج مطلوب"),
  supplier: z.string().min(1, "المورد مطلوب"),
  containerNumber: z.string().optional(),
  notesText: z.string().optional(),
});

type NewShipmentData = z.infer<typeof newShipmentSchema>;

export default function Tracker() {
  const { shipments, saveShipment, deleteShipment } = useShipments();
  const { toast } = useToast();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [newNoteText, setNewNoteText] = useState("");

  const addForm = useForm<NewShipmentData>({
    resolver: zodResolver(newShipmentSchema),
    defaultValues: { name: "", productName: "", supplier: "", containerNumber: "", notesText: "" },
  });

  const onAddSubmit = (data: NewShipmentData) => {
    const now = Date.now();
    const notes: ShipmentNote[] = data.notesText
      ? [{ id: `note-${now}`, timestamp: now, content: data.notesText }]
      : [];

    const newShipment: Shipment = {
      id: `ship-${now}`,
      createdAt: now,
      updatedAt: now,
      name: data.name,
      productName: data.productName,
      supplier: data.supplier,
      containerNumber: data.containerNumber,
      purchaseDate: now,
      stage: "تم الشراء",
      notes,
    };

    saveShipment(newShipment);
    toast({ title: "تمت الإضافة", description: "تمت إضافة الشحنة بنجاح" });
    setIsAddOpen(false);
    addForm.reset();
  };

  const advanceStage = (shipment: Shipment) => {
    const currentIndex = STAGES.indexOf(shipment.stage);
    if (currentIndex < STAGES.length - 1) {
      const newStage = STAGES[currentIndex + 1];
      const updated = {
        ...shipment,
        stage: newStage,
        updatedAt: Date.now(),
        notes: [
          { id: `note-${Date.now()}`, timestamp: Date.now(), content: `تم تحديث الحالة إلى: ${newStage}` },
          ...shipment.notes,
        ],
      };
      saveShipment(updated);
      if (selectedShipment?.id === shipment.id) setSelectedShipment(updated);
    }
  };

  const addNote = () => {
    if (!selectedShipment || !newNoteText.trim()) return;
    const now = Date.now();
    const updated = {
      ...selectedShipment,
      updatedAt: now,
      notes: [
        { id: `note-${now}`, timestamp: now, content: newNoteText.trim() },
        ...selectedShipment.notes,
      ],
    };
    saveShipment(updated);
    setSelectedShipment(updated);
    setNewNoteText("");
  };

  const handleExportPDF = async () => {
    if (shipments.length === 0) return;
    await exportShipmentsPDF(shipments);
    toast({ title: "تم تصدير PDF", description: `تم تصدير ${shipments.length} شحنة` });
  };

  const handleExportExcel = () => {
    if (shipments.length === 0) return;
    exportShipmentsExcel(shipments);
    toast({ title: "تم تصدير Excel", description: `تم تصدير ${shipments.length} شحنة` });
  };

  const StagePill = ({ stage }: { stage: Stage }) => {
    const colors: Record<Stage, string> = {
      "تم الشراء": "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
      "في مستودع الصين": "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
      "في البحر / الجو": "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
      "التخليص الجمركي": "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
      "واصل للمستودع": "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-bold whitespace-nowrap ${colors[stage]}`}>
        {stage}
      </span>
    );
  };

  return (
    <div className="space-y-8 pb-12 h-full flex flex-col">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Ship className="w-8 h-8 text-primary" />
            متابعة الشحنات
          </h2>
          <p className="text-muted-foreground mt-1">تتبع خط سير الشحنات من المورد حتى وصولها للمستودع.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Export buttons */}
          {shipments.length > 0 && (
            <>
              <Button
                variant="outline"
                className="gap-2 text-blue-600 border-blue-300 hover:bg-blue-50"
                onClick={handleExportPDF}
              >
                <FileText className="w-4 h-4" />
                تصدير PDF
              </Button>
              <Button
                variant="outline"
                className="gap-2 text-green-600 border-green-300 hover:bg-green-50"
                onClick={handleExportExcel}
              >
                <FileSpreadsheet className="w-4 h-4" />
                تصدير Excel
              </Button>
            </>
          )}

          {/* Add shipment */}
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 font-bold shadow-md">
                <Plus className="w-5 h-5" /> إضافة شحنة جديدة
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]" dir="rtl">
              <DialogHeader>
                <DialogTitle>شحنة جديدة</DialogTitle>
              </DialogHeader>
              <form onSubmit={addForm.handleSubmit(onAddSubmit)} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>اسم الشحنة (للمرجع)</Label>
                  <Input placeholder="مثال: شحنة الجوارب #001" {...addForm.register("name")} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>المنتج الأساسي</Label>
                    <Input {...addForm.register("productName")} />
                  </div>
                  <div className="space-y-2">
                    <Label>المورد / المصنع</Label>
                    <Input {...addForm.register("supplier")} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>رقم الحاوية / التتبع (اختياري)</Label>
                  <Input placeholder="مثال: TCKU1234567" {...addForm.register("containerNumber")} />
                </div>
                <div className="space-y-2">
                  <Label>ملاحظات أولية</Label>
                  <Input placeholder="أي معلومات إضافية..." {...addForm.register("notesText")} />
                </div>
                <div className="pt-4 flex justify-end">
                  <Button type="submit" className="w-full sm:w-auto">إنشاء الشحنة</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Kanban */}
      <div className="flex-1 overflow-x-auto pb-4">
        <div className="flex gap-6 min-w-max h-full">
          {STAGES.map((stage) => {
            const stageShipments = shipments
              .filter((s) => s.stage === stage)
              .sort((a, b) => b.updatedAt - a.updatedAt);

            return (
              <div key={stage} className="w-80 flex-shrink-0 flex flex-col bg-muted/30 rounded-xl p-3 border border-border/50">
                <div className="flex items-center justify-between mb-4 px-1">
                  <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${
                      stage === "تم الشراء" ? "bg-blue-500" :
                      stage === "في مستودع الصين" ? "bg-purple-500" :
                      stage === "في البحر / الجو" ? "bg-amber-500" :
                      stage === "التخليص الجمركي" ? "bg-orange-500" :
                      "bg-green-500"
                    }`} />
                    {stage}
                  </h3>
                  <span className="bg-background text-muted-foreground text-xs px-2 py-0.5 rounded-full shadow-sm">
                    {stageShipments.length}
                  </span>
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto pr-1 custom-scrollbar">
                  {stageShipments.map((shipment) => (
                    <Card
                      key={shipment.id}
                      className="cursor-pointer hover:border-primary/50 transition-colors shadow-sm hover:shadow-md"
                      onClick={() => setSelectedShipment(shipment)}
                    >
                      <CardContent className="p-3">
                        <div className="font-bold text-sm mb-1">{shipment.name}</div>
                        <div className="text-xs text-muted-foreground mb-3 flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {shipment.supplier}
                        </div>

                        {shipment.containerNumber && (
                          <div className="bg-muted px-2 py-1 rounded text-[10px] font-mono mb-3 w-fit">
                            {shipment.containerNumber}
                          </div>
                        )}

                        <div className="flex items-center justify-between border-t pt-2 mt-2">
                          <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {format(new Date(shipment.updatedAt), "dd/MM/yyyy")}
                          </div>

                          {stage !== "واصل للمستودع" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-primary hover:bg-primary/10 -ml-2"
                              onClick={(e) => { e.stopPropagation(); advanceStage(shipment); }}
                            >
                              تقدم <ArrowLeft className="w-3 h-3 mr-1" />
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {stageShipments.length === 0 && (
                    <div className="h-24 flex items-center justify-center border-2 border-dashed rounded-lg border-muted-foreground/20 text-muted-foreground/50 text-xs">
                      لا توجد شحنات
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detail Sheet */}
      <Sheet open={!!selectedShipment} onOpenChange={(open) => !open && setSelectedShipment(null)}>
        <SheetContent className="w-[400px] sm:w-[540px] flex flex-col p-0 border-l-sidebar-border bg-background" dir="rtl">
          {selectedShipment && (
            <>
              <div className="p-6 bg-sidebar text-sidebar-foreground">
                <SheetHeader className="text-right space-y-0">
                  <div className="flex justify-between items-start mb-2">
                    <StagePill stage={selectedShipment.stage} />
                    <span className="text-xs text-sidebar-foreground/60 font-mono">
                      ID: {selectedShipment.id.split("-")[1]}
                    </span>
                  </div>
                  <SheetTitle className="text-2xl text-white font-bold">{selectedShipment.name}</SheetTitle>
                  <SheetDescription className="text-sidebar-foreground/80 flex items-center gap-2 mt-1">
                    <MapPin className="w-4 h-4" /> {selectedShipment.supplier}
                  </SheetDescription>
                </SheetHeader>

                <div className="grid grid-cols-2 gap-4 mt-6 text-sm">
                  <div className="bg-sidebar-accent/50 p-3 rounded-lg">
                    <p className="text-sidebar-foreground/60 text-xs mb-1">المنتج</p>
                    <p className="font-bold">{selectedShipment.productName}</p>
                  </div>
                  <div className="bg-sidebar-accent/50 p-3 rounded-lg">
                    <p className="text-sidebar-foreground/60 text-xs mb-1">رقم الحاوية/التتبع</p>
                    <p className="font-bold font-mono">{selectedShipment.containerNumber || "غير محدد"}</p>
                  </div>
                </div>

                {selectedShipment.stage !== "واصل للمستودع" && (
                  <Button
                    className="w-full mt-6 bg-primary text-primary-foreground hover:bg-primary/90 font-bold"
                    onClick={() => advanceStage(selectedShipment)}
                  >
                    تحديث الحالة إلى: {STAGES[STAGES.indexOf(selectedShipment.stage) + 1]}
                  </Button>
                )}
              </div>

              <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-6">
                <div>
                  <h3 className="font-bold mb-4 flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-primary" />
                    سجل الملاحظات والتحديثات
                  </h3>

                  <div className="flex gap-2 mb-6">
                    <Input
                      placeholder="أضف تحديثاً أو ملاحظة..."
                      value={newNoteText}
                      onChange={(e) => setNewNoteText(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addNote()}
                    />
                    <Button onClick={addNote} size="icon" className="shrink-0">
                      <Save className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-muted before:to-transparent pr-4">
                    {selectedShipment.notes.map((note) => (
                      <div key={note.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                        <div className="flex items-center justify-center w-6 h-6 rounded-full border-2 border-background bg-primary text-primary-foreground shadow shrink-0 absolute right-[-28px] md:relative md:right-0" />
                        <div className="bg-muted/50 p-3 rounded-xl w-full border shadow-sm">
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(note.timestamp), "dd/MM/yyyy HH:mm")}
                            </span>
                          </div>
                          <p className="text-sm">{note.content}</p>
                        </div>
                      </div>
                    ))}
                    {selectedShipment.notes.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center">لا توجد ملاحظات مسجلة.</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-4 border-t bg-muted/20">
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => { deleteShipment(selectedShipment.id); setSelectedShipment(null); }}
                >
                  حذف الشحنة نهائياً
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
