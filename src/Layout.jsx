import React from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { LayoutDashboard, Layers, Receipt, User, PanelLeftClose, PanelLeft } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

const navigationItems = [
  {
    title: "בית",
    url: createPageUrl("Dashboard"),
    icon: LayoutDashboard,
  },
  {
    title: "כרטיסים",
    url: createPageUrl("Batches"),
    icon: Layers,
  },
];

function SidebarToggle() {
  const { toggleSidebar, open } = useSidebar();
  return (
    <button
      onClick={toggleSidebar}
      className="p-1 hover:bg-slate-100 rounded transition-colors text-slate-400 hover:text-slate-600"
    >
      {open ? <PanelLeftClose className="w-3.5 h-3.5" /> : <PanelLeft className="w-3.5 h-3.5" />}
    </button>
  );
}

function SidebarNav({ location }) {
  const { open } = useSidebar();
  
  return (
    <SidebarMenu>
      {navigationItems.map((item) => (
        <SidebarMenuItem key={item.title}>
          {open ? (
            <SidebarMenuButton 
              asChild 
              className={`hover:bg-slate-50 transition-colors rounded ${
                location.pathname === item.url ? 'bg-slate-100 text-slate-900' : 'text-slate-500'
              }`}
            >
              <Link to={item.url} className="flex items-center gap-2 px-2 py-1.5">
                <item.icon className="w-4 h-4 shrink-0" />
                <span className="text-xs font-medium">{item.title}</span>
              </Link>
            </SidebarMenuButton>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <SidebarMenuButton 
                  asChild 
                  className={`hover:bg-slate-50 transition-colors rounded justify-center ${
                    location.pathname === item.url ? 'bg-slate-100 text-slate-900' : 'text-slate-500'
                  }`}
                >
                  <Link to={item.url} className="flex items-center justify-center p-1.5">
                    <item.icon className="w-4 h-4" />
                  </Link>
                </SidebarMenuButton>
              </TooltipTrigger>
              <TooltipContent side="left" className="text-xs">{item.title}</TooltipContent>
            </Tooltip>
          )}
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}

function MainHeader() {
  return (
    <header className="hidden md:flex items-center justify-between px-6 py-3 border-b border-slate-100 bg-white/80 backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
          <Receipt className="w-3.5 h-3.5 text-white" />
        </div>
        <h1 className="font-semibold text-slate-900 text-sm">חשבונית חכמה</h1>
      </div>
    </header>
  );
}

export default function Layout({ children, currentPageName }) {
  const location = useLocation();

  return (
    <SidebarProvider defaultOpen={false}>
      <TooltipProvider delayDuration={0}>
        <div className="min-h-screen flex w-full bg-gradient-to-br from-slate-50 via-white to-blue-50/30 pb-16 md:pb-0" dir="rtl">
          <Sidebar collapsible="icon" className="border-l border-slate-100 bg-white hidden md:flex" side="right">
            <SidebarContent className="p-1 pt-2">
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarNav location={location} />
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>

            <SidebarFooter className="p-1 border-t border-slate-100">
              <div className="flex items-center gap-1 group-data-[state=collapsed]:flex-col">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded transition-colors">
                      <div className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center shrink-0">
                        <User className="w-3 h-3 text-slate-500" />
                      </div>
                      <span className="text-xs text-slate-500 group-data-[state=collapsed]:hidden">חשבון</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="text-xs">חשבון</TooltipContent>
                </Tooltip>
                <SidebarToggle />
              </div>
            </SidebarFooter>
          </Sidebar>

        <main className="flex-1 flex flex-col w-full">
          <MainHeader />
          <header className="bg-white/80 backdrop-blur-sm border-b border-slate-100 px-4 py-3 md:hidden">
            <div className="flex items-center justify-center gap-2">
              <div className="w-6 h-6 bg-blue-600 rounded-lg flex items-center justify-center">
                <Receipt className="w-3 h-3 text-white" />
              </div>
              <h1 className="text-base font-semibold text-slate-900">חשבונית חכמה</h1>
            </div>
          </header>

          <div className="flex-1 overflow-auto">
            {children}
          </div>
        </main>

        {/* Mobile Bottom Navigation */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-40 px-6 py-2 pb-safe">
            <div className="flex justify-around items-center">
                {navigationItems.map((item) => {
                    const isActive = location.pathname === item.url;
                    return (
                        <Link 
                            key={item.title} 
                            to={item.url} 
                            className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${isActive ? 'text-blue-600' : 'text-slate-400'}`}
                        >
                            <item.icon className={`w-6 h-6 ${isActive ? 'fill-blue-100' : ''}`} />
                            <span className="text-[10px] font-medium">{item.title}</span>
                        </Link>
                    )
                })}
                <button className="flex flex-col items-center gap-1 p-2 rounded-xl text-slate-400">
                    <User className="w-6 h-6" />
                    <span className="text-[10px] font-medium">פרופיל</span>
                </button>
            </div>
        </div>
      </div>
      </TooltipProvider>
    </SidebarProvider>
  );
}