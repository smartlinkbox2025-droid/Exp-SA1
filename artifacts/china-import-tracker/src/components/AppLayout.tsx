import { Link, useLocation } from "wouter";
import { LayoutDashboard, Calculator, PackageCheck, Ship, Menu } from "lucide-react";
import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);

  const navItems = [
    { href: "/", label: "الرئيسية", icon: LayoutDashboard },
    { href: "/calculator", label: "حاسبة الجدوى", icon: Calculator },
    { href: "/packing", label: "بيان التعبئة", icon: PackageCheck },
    { href: "/tracker", label: "متابعة الشحنات", icon: Ship },
  ];

  const NavLinks = () => (
    <>
      {navItems.map((item) => {
        const isActive = location === item.href;
        return (
          <Link key={item.href} href={item.href} onClick={() => setOpen(false)}>
            <span
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors cursor-pointer ${
                isActive
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </span>
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="flex min-h-screen bg-gray-50/50 dark:bg-gray-900/50 text-foreground dir-rtl">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col bg-sidebar border-l border-sidebar-border h-screen sticky top-0">
        <div className="p-6">
          <div className="flex items-center gap-3 text-sidebar-primary">
            <Ship className="w-8 h-8" />
            <h1 className="text-xl font-bold text-white tracking-tight">مستورد الصين</h1>
          </div>
          <p className="text-sidebar-foreground/50 text-xs mt-2 font-medium px-1">متتبع الاستيراد الاحترافي</p>
        </div>
        <nav className="flex-1 px-4 space-y-1">
          <NavLinks />
        </nav>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 w-full bg-sidebar border-b border-sidebar-border z-50 flex items-center justify-between p-4 h-16">
        <div className="flex items-center gap-2 text-sidebar-primary">
          <Ship className="w-6 h-6" />
          <h1 className="text-lg font-bold text-white tracking-tight">مستورد الصين</h1>
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-white hover:bg-sidebar-accent">
              <Menu className="w-6 h-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="bg-sidebar border-l-sidebar-border w-72 p-0 flex flex-col pt-16">
            <nav className="px-4 space-y-2 mt-4">
              <NavLinks />
            </nav>
          </SheetContent>
        </Sheet>
      </div>

      {/* Main Content */}
      <main className="flex-1 w-full md:w-auto pt-16 md:pt-0 min-h-screen">
        <div className="p-4 md:p-8 max-w-7xl mx-auto h-full">
          {children}
        </div>
      </main>
    </div>
  );
}
