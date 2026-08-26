"use client";

import React, { useState } from 'react';
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Bell, TrendingUp, Package, FileText, Settings, Menu, X, History, type LucideIcon } from "lucide-react";

type NavItem = {
  name: string;
  path: string;
  icon: LucideIcon;
};

export default function AppNavigation() {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const navItems: NavItem[] = [
    { name: "Home", path: "/dashboard", icon: Home },
    { name: "Alerts", path: "/alerts", icon: Bell },
    { name: "Forecast", path: "/forecast", icon: TrendingUp },
    { name: "Stock", path: "/inventory", icon: Package },
    { name: "History", path: "/transactions", icon: History },
    { name: "Invoice", path: "/invoice", icon: FileText },
  ];

  return (
    <>
      {/* =========================================
          MOBILE VIEW: Bottom Navigation Bar
          ========================================= */}
      <div className="h-28 w-full md:hidden" />
      <div className="fixed bottom-4 left-4 right-4 z-40 md:hidden pointer-events-none">
        <div className="advanced-panel rounded-3xl pointer-events-auto px-4 py-3 flex justify-between items-center border border-white/5 relative shadow-[0_8px_32px_rgba(0,0,0,0.8)]">
          <div className="flex justify-between w-full">
            {navItems.map((item, index) => {
              const isActive = pathname === item.path || (item.path !== "/dashboard" && pathname?.startsWith(item.path));
              const Icon = item.icon;
              
              // Insert MicFAB spacer in the center (between Forecast and Stock)
              if (index === 3) {
                return (
                  <React.Fragment key={item.path + '-fragment'}>
                    <div className="w-14 h-10 pointer-events-none shrink-0" />
                    <MobileNavItem item={item} isActive={isActive} Icon={Icon} />
                  </React.Fragment>
                );
              }

              return <MobileNavItem key={item.path} item={item} isActive={isActive} Icon={Icon} />;
            })}
          </div>
        </div>
      </div>

      {/* =========================================
          DESKTOP VIEW: Top Header + Drawer Sidebar
          ========================================= */}
      
      {/* Desktop Persistent Header Trigger */}
      <div className="hidden md:flex fixed top-0 left-0 w-full p-6 z-40 pointer-events-none">
        <button 
          onClick={() => setIsSidebarOpen(true)}
          className="pointer-events-auto flex items-center justify-center w-12 h-12 bg-[#231A3F]/50 backdrop-blur-md rounded-2xl border border-white/10 text-white hover:bg-[#c084fc]/20 hover:border-[#c084fc]/50 transition-all shadow-[0_8px_32px_rgba(0,0,0,0.4)] hover:shadow-[0_8px_32px_rgba(192,132,252,0.2)]"
        >
          <Menu size={24} />
        </button>
      </div>

      {/* Sidebar Drawer Overlay */}
      <div 
        className={`hidden md:block fixed inset-0 bg-[#090614]/80 backdrop-blur-sm z-50 transition-opacity duration-300 ${
          isSidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setIsSidebarOpen(false)}
      >
        {/* Drawer Panel */}
        <div 
          className={`absolute top-0 left-0 w-72 h-full advanced-panel flex flex-col p-8 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            isSidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-10">
            <div>
              <h1 className="text-3xl font-black bg-gradient-to-r from-[#9333ea] to-[#c084fc] bg-clip-text text-transparent pb-1">SmartDukaan</h1>
              <p className="text-[10px] font-bold text-[#c084fc]/70 uppercase tracking-widest mt-1">AI Coach</p>
            </div>
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="w-10 h-10 flex items-center justify-center bg-white/5 rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex flex-col gap-2 flex-1 mt-6">
            {navItems.map((item) => {
              const isActive = pathname === item.path || (item.path !== "/dashboard" && pathname?.startsWith(item.path));
              const Icon = item.icon;
              return (
                <DesktopNavItem 
                  key={item.path} 
                  item={item} 
                  isActive={isActive} 
                  Icon={Icon} 
                  onClick={() => setIsSidebarOpen(false)}
                />
              );
            })}
          </div>
          
          <div className="mt-auto pt-6 border-t border-white/10">
            <DesktopNavItem 
              item={{ name: "Settings", path: "/settings", icon: Settings }} 
              isActive={pathname === "/settings"} 
              Icon={Settings} 
              onClick={() => setIsSidebarOpen(false)}
            />
          </div>
        </div>
      </div>
    </>
  );
}

// Mobile Item specific to Bottom Nav
function MobileNavItem({ item, isActive, Icon }: { item: NavItem; isActive: boolean; Icon: LucideIcon }) {
  return (
    <Link
      href={item.path}
      className={`flex flex-col items-center justify-center p-2 relative w-16 transition-all duration-300 group ${
        isActive 
          ? "text-[#c084fc]" 
          : "text-[#c084fc]/40 hover:text-[#c084fc]/80"
      }`}
    >
      <div className={`${isActive ? '-translate-y-1' : ''} transition-transform`}>
        <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
      </div>
      <span className={`text-[9px] mt-1 font-bold uppercase tracking-wider ${isActive ? "text-[#c084fc]" : ""}`}>
        {item.name}
      </span>
      {isActive && (
         <div className="absolute -bottom-1 w-1 h-1 rounded-full bg-[#c084fc] shadow-[0_0_8px_#c084fc]" />
      )}
    </Link>
  );
}

// Desktop Item specific to Drawer
function DesktopNavItem({ item, isActive, Icon, onClick }: { item: NavItem; isActive: boolean; Icon: LucideIcon; onClick: () => void }) {
  return (
    <Link
      href={item.path}
      onClick={onClick}
      className={`flex items-center px-4 py-4 rounded-2xl transition-all duration-200 group ${
        isActive 
          ? "bg-gradient-to-r from-[#9333ea]/20 to-transparent text-white border border-[#c084fc]/30 shadow-[inset_4px_0_0_#c084fc]" 
          : "text-[#c084fc]/60 hover:text-white hover:bg-white/5 border border-transparent"
      }`}
    >
      <Icon size={22} strokeWidth={isActive ? 2.5 : 2} className={isActive ? "text-[#c084fc]" : ""} />
      <span className={`ml-4 text-sm font-bold tracking-widest uppercase ${isActive ? "text-white" : ""}`}>
        {item.name}
      </span>
    </Link>
  );
}
