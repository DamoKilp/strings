// /components/outerSidebar/outerSidebar.tsx
'use client';
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Settings, LogOut, Sun, Moon, Laptop, Menu, Bug, Image, Palette, Layers, Gamepad2, Rocket, ChevronRight } from 'lucide-react';
import { useState, useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/components/ui/use-mobile";
import { SidebarNavItems } from "./SidebarNavItems";
import { useChatContext } from "@/components/contexts/ChatProvider";
import { useRBAC } from "@/app/hooks/useRBAC";
import { UserRole } from "@/types/rbac";
import { clearUserDataOnSignOut, forceRedirectToSignIn } from "@/utils/auth/authUtils";
import { signOutAction } from "@/app/actions";
// import { supabase } from "@/utils/supabase/client"; // No longer needed - using unified auth
import { useTheme } from "next-themes";
import { useBackgroundMode } from "@/components/contexts/BackgroundModeContext";
// ProjectSwitcher moved to FacilitiesSidebar

const FACADE_PRESETS = [
  { value: 'intense', label: 'Intense', description: 'Maximum saturation' },
  { value: 'purple-dream', label: 'Purple Dream', description: 'Like attached image' },
  { value: 'ocean', label: 'Ocean', description: 'Blue water theme' },
  { value: 'lavender', label: 'Lavender', description: 'Light purple theme' },
  { value: 'sunset-triad', label: 'Sunset Blend', description: 'Orange • Purple • Blue' },
  { value: 'aurora-triad', label: 'Aurora Blend', description: 'Green • Violet • Pink' },
  { value: 'tropical-triad', label: 'Tropical Blend', description: 'Lime • Teal • Amber' },
  { value: 'cosmic-triad', label: 'Cosmic Blend', description: 'Indigo • Purple • Blue' },
] as const;

export function OuterSidebar() {
  const _pathname = usePathname();
  const _router = useRouter();
  const [hoveredIcon, setHoveredIcon] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [isTabVisible, setIsTabVisible] = useState(true);
  const [authRetryCount, setAuthRetryCount] = useState(0);
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);
  const { user } = useChatContext();
  const { hasRole, isLoading } = useRBAC();
  const { theme, setTheme } = useTheme();
  const { backgroundMode, facadePreset, setBackgroundMode, setFacadePreset } = useBackgroundMode();
  const isMobile = useIsMobile();

  // 🚀 PHASE 2 UX: Ultra-aggressive authorization checks for instant UX
  const isAuthDebugAuthorized = (!isLoading || (isLoading && authRetryCount >= 1)) && hasRole(UserRole.SUPER_ADMIN) && isTabVisible;
  const isAuthDebugEnabled = process.env.NODE_ENV !== 'production';


  // 🎯 PHASE 1 FIX: Enhanced mounting and tab visibility handling
  useEffect(() => {
    setMounted(true);
    
    // Handle tab visibility changes
    const handleVisibilityChange = () => {
      const visible = document.visibilityState === 'visible';
      setIsTabVisible(visible);
      
      if (visible) {
        // Tab became visible, reset auth retry count
        setAuthRetryCount(0);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // 🚀 PHASE 2 UX: Ultra-fast button visibility recovery
  useEffect(() => {
    // 🚀 IMMEDIATE RESPONSE: Show buttons much faster when auth is loading
    if (isLoading && authRetryCount < 3) {
      const timer = setTimeout(() => {
        setAuthRetryCount(prev => prev + 1);
      }, 1000); // 🚀 MUCH FASTER: 1 second instead of 3 seconds
      
      return () => clearTimeout(timer);
    }
  }, [isLoading, authRetryCount]);

  // Handle sign out functionality with immediate redirect approach
  const handleSignOut = async () => {
    try {
      try {

        
        // 1. GET CURRENT USER ID BEFORE SIGN-OUT
        let currentUserId: string | undefined;
        try {
          // Use the user from ChatProvider context instead of direct auth call
          currentUserId = user?.id;

        } catch (_error) {

        }
        
        // 2. IMMEDIATE NAVIGATION (perceived performance and robustness for PWA)
        // Tag the URL so middleware won't bounce us back if session still exists momentarily
        try {
          const url = new URL('/sign-in', window.location.origin)
          url.searchParams.set('logout', '1')
          window.location.replace(url.toString())
        } catch {
          forceRedirectToSignIn();
        }
        
        // 3. IMMEDIATE LOCAL CLEANUP (UI responsiveness)
        if (typeof window !== 'undefined') {
          // 🎯 TARGETED FIX: Async cache clearing (non-blocking for performance)
          clearUserDataOnSignOut(currentUserId).catch((error) => {

          });

        }
        
        // 4. BACKGROUND SERVER CLEANUP (fire and forget)
        signOutAction().catch((_error) => {

        });
        
        } catch (_error) {

        // Always redirect even on error
        forceRedirectToSignIn();
      }
    } catch {}
  };

  // Mobile Drawer Sidebar
  if (isMobile) {
    return (
      <Sheet open={isMobileSheetOpen} onOpenChange={setIsMobileSheetOpen}>
        <SheetTrigger asChild>
          <button
            className="fixed top-4 left-4 z-[60] flex items-center justify-center w-11 h-11 rounded-full bg-background/80 shadow-lg border border-border backdrop-blur-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            aria-label="Open navigation"
          >
            <Menu size={28} />
          </button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-2/3 max-w-[240px] flex flex-col h-full bg-gray-950 text-white" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
          {/* Hidden title for accessibility (Radix Dialog requirement) */}
          <SheetHeader>
            <SheetTitle className="sr-only">Navigation</SheetTitle>
          </SheetHeader>
          {/* User/Brand Dropdown */}
          <div className="flex flex-col items-center py-4 border-b" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold text-2xl shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2"
                  aria-label="User menu"
                >
                  {user?.email?.charAt(0).toUpperCase() || 'A'}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="right"
                align="start"
                className="w-56 ml-2 bg-gray-950 text-gray-100 border border-gray-800"
                sideOffset={8}
              >
                {user && (
                  <>
                    <div className="px-3 py-2 border-b" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold">
                          {user.email?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-100 truncate">
                            {user.email || 'User'}
                          </p>
                          <p className="text-xs text-gray-400">
                            Signed in
                          </p>
                        </div>
                      </div>
                    </div>
                    <DropdownMenuSeparator className="bg-gray-800" />
                  </>
                )}
                <DropdownMenuItem asChild>
                  <Link href="/" className="flex items-center gap-2 w-full text-gray-300 hover:bg-gray-900! hover:text-white! focus:bg-gray-900! focus:text-white!" onClick={() => setIsMobileSheetOpen(false)}>
                    Home
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="flex items-center gap-2 w-full text-gray-300 hover:bg-gray-900! hover:text-white! focus:bg-gray-900! focus:text-white!" onClick={() => setIsMobileSheetOpen(false)}>
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-gray-800" />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="flex items-center gap-2 text-red-400 hover:bg-gray-800 hover:text-red-300 focus:bg-gray-800 focus:text-red-300"
                  data-sign-out-button="true"
                >
                  <LogOut size={16} />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="mt-2 text-base font-semibold text-white">
              {user?.email || "User"}
            </div>
          </div>
          {/* Project Switcher moved to FacilitiesSidebar */}

          {/* Navigation Items */}
          <nav className="flex-1 flex flex-col items-center justify-start py-4">
            <SidebarNavItems
              orientation="vertical"
              onNavigate={() => setIsMobileSheetOpen(false)}
              showTooltips={false}
              iconSize={24}
              className="w-full"
            />
          </nav>
          {/* Theme Switcher */}
          <div className="flex flex-col items-center py-2 border-t" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
            {mounted && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center justify-center w-10 h-10 rounded-full transition-all duration-200"
                  aria-label="Theme"
                  style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                  }}
                >
                    {theme === "light" ? (
                      <Sun size={24} className="text-gray-300" />
                    ) : theme === "dark" ? (
                      <Moon size={24} className="text-gray-300" />
                    ) : (
                      <Laptop size={24} className="text-gray-300" />
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  side="right"
                  align="center"
                  className="w-60 ml-2 bg-gray-950 text-gray-100 border border-gray-800"
                  sideOffset={8}
                >
                  
                  <DropdownMenuSeparator className="bg-gray-800" />
                  {/* Secret Games Section - Icon Only */}
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="flex items-center gap-3 cursor-pointer text-gray-300 hover:bg-gray-900! hover:text-white! focus:bg-gray-900! focus:text-white!">
                      <Gamepad2 size={18} className="text-purple-300" />
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-56 bg-gray-950 text-gray-100 border border-gray-800">
                      <DropdownMenuLabel className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Available Games
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator className="bg-gray-800" />
                      <DropdownMenuItem
                        className="flex items-center gap-3 cursor-pointer text-gray-300 hover:bg-gray-900! hover:text-white!"
                        onClick={() => window.location.href = '/games/space-onvaders'}
                      >
                        <Rocket size={16} className="text-blue-300" />
                        <div className="flex flex-col">
                          <span className="font-medium">Space Onvaders</span>
                          <span className="text-xs text-muted-foreground">
                            Defend Earth from invasion
                          </span>
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="flex items-center gap-3 cursor-pointer text-gray-300 hover:bg-gray-900! hover:text-white!"
                        onClick={() => window.location.href = '/games/neon-snake'}
                      >
                        <div className="w-4 h-4 rounded-sm bg-gradient-to-r from-cyan-400 to-purple-400" />
                        <div className="flex flex-col">
                          <span className="font-medium">Neon Snake Evolution</span>
                          <span className="text-xs text-muted-foreground">
                            Evolve and conquer
                          </span>
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="flex items-center gap-3 cursor-pointer text-gray-300 hover:bg-gray-900! hover:text-white!"
                        onClick={() => window.location.href = '/games/super-mario'}
                      >
                        <div className="w-4 h-4 rounded-sm bg-red-500 flex items-center justify-center text-white text-[10px] font-bold">
                          M
                        </div>
                        <div className="flex flex-col">
                          <span className="font-medium">Super Mario</span>
                          <span className="text-xs text-muted-foreground">
                            Classic platform adventure
                          </span>
                        </div>
                      </DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuSeparator className="bg-gray-800" />
                  {/* Simplified Theme Options: System and Dark, each with combined backgrounds */}
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="flex items-center gap-3 cursor-pointer text-gray-300 hover:bg-gray-900! hover:text-white! focus:bg-gray-900! focus:text-white!">
                      <Laptop size={18} className="text-gray-300" />
                      <span>System</span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-56 bg-gray-950 text-gray-100 border border-gray-800">
                      <DropdownMenuLabel className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Choose Background
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator className="bg-gray-800" />
                      <DropdownMenuItem className="flex items-center gap-3 cursor-pointer text-gray-300 hover:bg-gray-900! hover:text-white!" onClick={() => { setTheme('system'); setBackgroundMode('image'); }}>
                        <Image size={16} className="text-blue-300" />
                        <span>Default image</span>
                      </DropdownMenuItem>
                      {FACADE_PRESETS.map((preset) => (
                        <DropdownMenuItem key={`sys-${preset.value}`} className="flex items-center gap-3 cursor-pointer text-gray-300 hover:bg-gray-900! hover:text-white!" onClick={() => { setTheme('system'); setFacadePreset(preset.value as any); setBackgroundMode('facade'); }}>
                          <Palette size={16} className="text-purple-300" />
                          <span>{preset.label}</span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="flex items-center gap-3 cursor-pointer text-gray-300 hover:bg-gray-900! hover:text-white! focus:bg-gray-900! focus:text-white!">
                      <Moon size={18} className="text-gray-300" />
                      <span>Dark</span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-56 bg-gray-950 text-gray-100 border border-gray-800">
                      <DropdownMenuLabel className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Choose Background
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator className="bg-gray-800" />
                      <DropdownMenuItem className="flex items-center gap-3 cursor-pointer text-gray-300 hover:bg-gray-900! hover:text-white!" onClick={() => { setTheme('dark'); setBackgroundMode('image'); }}>
                        <Image size={16} className="text-blue-300" />
                        <span>Default image</span>
                      </DropdownMenuItem>
                      {FACADE_PRESETS.map((preset) => (
                        <DropdownMenuItem key={`dark-${preset.value}`} className="flex items-center gap-3 cursor-pointer text-gray-300 hover:bg-gray-900! hover:text-white!" onClick={() => { setTheme('dark'); setFacadePreset(preset.value as any); setBackgroundMode('facade'); }}>
                          <Palette size={16} className="text-purple-300" />
                          <span>{preset.label}</span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

          </div>
          {/* Settings at bottom */}
          <div className="flex flex-col items-center py-2">
            <Link
              href="/settings"
              className="flex items-center gap-2 text-gray-300 hover:text-white transition-all duration-300 text-sm"
              onClick={() => setIsMobileSheetOpen(false)}
            >
              <Settings size={20} />
              <span>Settings</span>
            </Link>
          </div>
          {/* Performance Monitoring removed (mobile) */}
          {/* Auth Debug (mobile) */}
          {isAuthDebugAuthorized && isAuthDebugEnabled && (
            <div className="flex flex-col items-center py-2">
              <button
                onClick={() => document.dispatchEvent(new Event('auth-debug-toggle'))}
                className="flex items-center gap-2 p-2 rounded-lg text-gray-300 hover:text-white transition-all duration-300"
              >
                <Bug size={22} />
                <span>Auth Debug</span>
              </button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop Sidebar
  return (
    <nav className="fixed left-0 top-0 bottom-0 w-16 flex flex-col items-center border-r bg-gray-950/95 backdrop-blur-md z-50 transition-all duration-300 shadow-sm" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
      {/* Logo/Brand - Now with dropdown menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="mt-6 mb-10 flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold text-xl shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2"
            aria-label="User menu"
          >
            {user?.email?.charAt(0).toUpperCase() || 'A'}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="right"
          align="start"
          className="w-56 ml-2 bg-gray-950 text-gray-100 border border-gray-800"
          sideOffset={8}
        >
          {user && (
            <>
              <div className="px-3 py-2 border-b" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold">
                    {user.email?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-100 truncate">
                      {user.email || 'User'}
                    </p>
                    <p className="text-xs text-gray-400">
                      Signed in
                    </p>
                  </div>
                </div>
              </div>
              <DropdownMenuSeparator className="bg-gray-800" />
            </>
          )}
          <DropdownMenuItem asChild>
            <Link href="/" className="flex items-center gap-2 w-full text-gray-300 hover:bg-gray-900! hover:text-white! focus:bg-gray-900! focus:text-white!">
              Home
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/settings" className="flex items-center gap-2 w-full text-gray-300 hover:bg-gray-900! hover:text-white! focus:bg-gray-900! focus:text-white!">
              Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-gray-800" />
          <DropdownMenuItem
            onClick={handleSignOut}
            className="flex items-center gap-2 text-red-400 hover:bg-gray-800 hover:text-red-300 focus:bg-gray-800 focus:text-red-300"
            data-sign-out-button="true"
          >
            <LogOut size={16} />
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {/* Project Switcher moved to FacilitiesSidebar */}

      {/* Navigation Icons */}
      <SidebarNavItems
        orientation="vertical"
        showTooltips={true}
        iconSize={22}
      />
      {/* Theme Switcher */}
      {mounted && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="relative group mt-8"
              aria-label="Theme"
              onMouseEnter={() => setHoveredIcon("Theme")}
              onMouseLeave={() => setHoveredIcon(null)}
            >
              <div className={`
              rounded-xl transition-all duration-300
              ${hoveredIcon === "Theme"
                ? 'bg-gradient-to-br text-white shadow-lg transform scale-105'
                : 'text-gray-100 hover:text-white hover:shadow-md'
              }
            `}
            style={{
              minWidth: 48,
              minHeight: 48,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: hoveredIcon === "Theme"
                ? 'linear-gradient(135deg, from-amber-500 to-orange-600)'
                : 'rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            }}>
                {theme === "light" ? (
                  <Sun
                    size={24}
                    className={hoveredIcon === "Theme" ? 'text-white' : 'text-gray-300'}
                    style={{
                      filter: hoveredIcon === "Theme" ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' : 'none',
                      transition: 'all 0.3s ease'
                    }}
                  />
                ) : theme === "dark" ? (
                  <Moon
                    size={24}
                    className={hoveredIcon === "Theme" ? 'text-white' : 'text-gray-300'}
                    style={{
                      filter: hoveredIcon === "Theme" ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' : 'none',
                      transition: 'all 0.3s ease'
                    }}
                  />
                ) : (
                  <Laptop
                    size={24}
                    className={hoveredIcon === "Theme" ? 'text-white' : 'text-gray-300'}
                    style={{
                      filter: hoveredIcon === "Theme" ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' : 'none',
                      transition: 'all 0.3s ease'
                    }}
                  />
                )}
              </div>
              {/* Tooltip */}
              <div className="absolute left-14 top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-gray-900 text-white text-sm rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 whitespace-nowrap">
                Theme
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="right"
            align="center"
            className="w-40 ml-2 bg-gray-950 text-gray-100 border border-gray-800"
            sideOffset={8}
          >
            
            {/* Secret Games Section - Icon Only */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="flex items-center gap-3 cursor-pointer text-gray-300 hover:bg-gray-900! hover:text-white! focus:bg-gray-900! focus:text-white!">
                <Gamepad2 size={18} className="text-purple-300" />
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-56 bg-gray-950 text-gray-100 border border-gray-800">
                <DropdownMenuLabel className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Available Games
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-gray-800" />
                <DropdownMenuItem
                  className="flex items-center gap-3 cursor-pointer text-gray-300 hover:bg-gray-900! hover:text-white!"
                  onClick={() => window.location.href = '/games/space-onvaders'}
                >
                  <Rocket size={16} className="text-blue-300" />
                  <div className="flex flex-col">
                    <span className="font-medium">Space Onvaders</span>
                    <span className="text-xs text-muted-foreground">
                      Defend Earth from invasion
                    </span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="flex items-center gap-3 cursor-pointer text-gray-300 hover:bg-gray-900! hover:text-white!"
                  onClick={() => window.location.href = '/games/neon-snake'}
                >
                  <div className="w-4 h-4 rounded-sm bg-gradient-to-r from-cyan-400 to-purple-400" />
                  <div className="flex flex-col">
                    <span className="font-medium">Neon Snake Evolution</span>
                    <span className="text-xs text-muted-foreground">
                      Evolve and conquer
                    </span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="flex items-center gap-3 cursor-pointer text-gray-300 hover:bg-gray-900! hover:text-white!"
                  onClick={() => window.location.href = '/games/super-mario'}
                >
                  <div className="w-4 h-4 rounded-sm bg-red-500 flex items-center justify-center text-white text-[10px] font-bold">
                    M
                  </div>
                  <div className="flex flex-col">
                    <span className="font-medium">Super Mario</span>
                    <span className="text-xs text-muted-foreground">
                      Classic platform adventure
                    </span>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator className="bg-gray-800" />
            {/* Simplified Theme Options: System and Dark, each with combined backgrounds */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="flex items-center gap-3 cursor-pointer text-gray-300 hover:bg-gray-900! hover:text-white! focus:bg-gray-900! focus:text-white!">
                <Laptop size={18} className="text-gray-300" />
                <span>System</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-56 bg-gray-950 text-gray-100 border border-gray-800">
                <DropdownMenuLabel className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Choose Background
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-gray-800" />
                <DropdownMenuItem className="flex items-center gap-3 cursor-pointer text-gray-300 hover:bg-gray-900! hover:text-white!" onClick={() => { setTheme('system'); setBackgroundMode('image'); }}>
                  <Image size={16} className="text-blue-300" />
                  <span>Default image</span>
                </DropdownMenuItem>
                {FACADE_PRESETS.map((preset) => (
                  <DropdownMenuItem key={`sys-${preset.value}`} className="flex items-center gap-3 cursor-pointer text-gray-300 hover:bg-gray-900! hover:text-white!" onClick={() => { setTheme('system'); setFacadePreset(preset.value as any); setBackgroundMode('facade'); }}>
                    <Palette size={16} className="text-purple-300" />
                    <span>{preset.label}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="flex items-center gap-3 cursor-pointer text-gray-300 hover:bg-gray-900! hover:text-white! focus:bg-gray-900! focus:text-white!">
                <Moon size={18} className="text-gray-300" />
                <span>Dark</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-56 bg-gray-950 text-gray-100 border border-gray-800">
                <DropdownMenuLabel className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Choose Background
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-gray-800" />
                <DropdownMenuItem className="flex items-center gap-3 cursor-pointer text-gray-300 hover:bg-gray-900! hover:text-white!" onClick={() => { setTheme('dark'); setBackgroundMode('image'); }}>
                  <Image size={16} className="text-blue-300" />
                  <span>Default image</span>
                </DropdownMenuItem>
                {FACADE_PRESETS.map((preset) => (
                  <DropdownMenuItem key={`dark-${preset.value}`} className="flex items-center gap-3 cursor-pointer text-gray-300 hover:bg-gray-900! hover:text-white!" onClick={() => { setTheme('dark'); setFacadePreset(preset.value as any); setBackgroundMode('facade'); }}>
                    <Palette size={16} className="text-purple-300" />
                    <span>{preset.label}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Auth Debug Button (Desktop) */}
      {isAuthDebugAuthorized && isAuthDebugEnabled && mounted && (
        <button
          onClick={() => document.dispatchEvent(new Event('auth-debug-toggle'))}
          className="relative group mt-4"
          aria-label="Auth Debug"
          onMouseEnter={() => setHoveredIcon("AuthDebug")}
          onMouseLeave={() => setHoveredIcon(null)}
        >
          <div className={`
            rounded-xl transition-all duration-300
            ${hoveredIcon === "AuthDebug"
              ? 'bg-gradient-to-br text-white shadow-lg transform scale-105'
              : 'text-gray-100 hover:text-white hover:shadow-md'
            }
          `}
          style={{
            minWidth: 48,
            minHeight: 48,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: hoveredIcon === "AuthDebug"
              ? 'linear-gradient(135deg, from-amber-500 to-orange-600)'
              : 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}>
            <Bug
              size={24}
              className={`${hoveredIcon === "AuthDebug" ? 'text-white' : 'text-amber-300'} ${isLoading ? 'animate-pulse' : ''}`}
              style={{
                filter: hoveredIcon === "AuthDebug" ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' : 'none',
                transition: 'all 0.3s ease'
              }}
            />
          </div>
          {/* Tooltip */}
          <div className="absolute left-14 top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-gray-900 text-white text-sm rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 whitespace-nowrap">
            Auth Debug {isLoading && authRetryCount >= 1 ? '(Recovering...)' : ''}
          </div>
        </button>
      )}

      {/* Spacer */}
      <div className="flex-1" />
      {/* Settings at bottom */}
      <Link
        href="/settings"
        className="my-6 relative group"
        onMouseEnter={() => setHoveredIcon("Settings")}
        onMouseLeave={() => setHoveredIcon(null)}
      >
        <div className={`
          rounded-xl transition-all duration-300
          ${hoveredIcon === "Settings"
            ? 'bg-gradient-to-br text-white shadow-lg transform scale-105'
            : 'text-gray-100 hover:text-white hover:shadow-md'
          }
        `}
        style={{
          minWidth: 48,
          minHeight: 48,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: hoveredIcon === "Settings"
            ? 'linear-gradient(135deg, from-indigo-500 to-purple-600)'
            : 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}>
          <Settings
            size={24}
            className={hoveredIcon === "Settings" ? 'text-white' : 'text-indigo-300'}
            style={{
              filter: hoveredIcon === "Settings" ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' : 'none',
              transition: 'all 0.3s ease'
            }}
          />
        </div>
        {/* Tooltip */}
        <div className="absolute left-14 top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-gray-900 text-white text-sm rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 whitespace-nowrap">
          Settings
        </div>
      </Link>
      {/* Performance Monitoring removed */}
      {/* Audit Panel removed */}
    </nav>
  );
}
