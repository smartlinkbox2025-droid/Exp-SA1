import { Card, CardContent } from "@/components/ui/card";
import { formatNumber, calculateFeasibility } from "@/lib/calculations";
import { useAppStorage } from "@/hooks/useLocalStorage";
import { Package, Ship, TrendingUp, AlertTriangle } from "lucide-react";
import { Link } from "wouter";

export default function Dashboard() {
  const { data } = useAppStorage();
  const { studies, shipments } = data;

  const totalProducts = studies.length;
  const activeShipments = shipments.filter(s => s.stage !== "واصل للمستودع").length;
  
  const allCalculations = studies.map(calculateFeasibility);
  const totalInvestedSAR = allCalculations.reduce((acc, curr) => acc + curr.totalLandedCostSAR, 0);
  const avgRoi = allCalculations.length > 0 
    ? allCalculations.reduce((acc, curr) => acc + curr.roiPct, 0) / allCalculations.length 
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">لوحة القيادة</h2>
          <p className="text-muted-foreground mt-1">نظرة عامة على أعمال الاستيراد الخاصة بك.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover-elevate shadow-sm border-l-4 border-l-blue-500">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">إجمالي المنتجات المدروسة</p>
                <p className="text-3xl font-bold">{totalProducts}</p>
              </div>
              <div className="p-3 bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400 rounded-xl">
                <Package className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover-elevate shadow-sm border-l-4 border-l-amber-500">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">شحنات نشطة</p>
                <p className="text-3xl font-bold">{activeShipments}</p>
              </div>
              <div className="p-3 bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400 rounded-xl">
                <Ship className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover-elevate shadow-sm border-l-4 border-l-green-500">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">رأس المال المستثمر (ر.س)</p>
                <p className="text-3xl font-bold">{formatNumber(totalInvestedSAR, 0)}</p>
              </div>
              <div className="p-3 bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-400 rounded-xl">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover-elevate shadow-sm border-l-4 border-l-purple-500">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">متوسط العائد على الاستثمار</p>
                <p className="text-3xl font-bold">{formatNumber(avgRoi, 1)}%</p>
              </div>
              <div className="p-3 bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-400 rounded-xl">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">أحدث الشحنات</h3>
            <Link href="/tracker" className="text-sm text-primary hover:underline font-medium">عرض الكل</Link>
          </div>
          <div className="space-y-3">
            {shipments.slice(0, 3).map(ship => (
              <Card key={ship.id} className="hover:bg-muted/50 transition-colors">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-bold">{ship.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">المورد: {ship.supplier}</p>
                  </div>
                  <div className="text-left bg-secondary px-3 py-1 rounded-full text-xs font-medium border">
                    {ship.stage}
                  </div>
                </CardContent>
              </Card>
            ))}
            {shipments.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">لا توجد شحنات.</p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">أحدث دراسات الجدوى</h3>
            <Link href="/calculator" className="text-sm text-primary hover:underline font-medium">حاسبة الجدوى</Link>
          </div>
          <div className="space-y-3">
            {studies.slice(0, 3).map(study => {
              const calc = calculateFeasibility(study);
              return (
                <Card key={study.id} className="hover:bg-muted/50 transition-colors">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-bold">{study.productName}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatNumber(study.quantity, 0)} وحدة | {study.currency} {study.factoryPrice}
                      </p>
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-green-600 dark:text-green-400">
                        ROI: {formatNumber(calc.roiPct, 1)}%
                      </p>
                      <p className="text-xs text-muted-foreground">
                        ر.س {formatNumber(calc.totalLandedCostSAR, 0)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {studies.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">لا توجد دراسات جدوى.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
