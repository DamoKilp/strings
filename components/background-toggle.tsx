"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Image, Palette, Layers, ChevronRight, Rocket, Gamepad2 } from "lucide-react";
import { useBackgroundMode } from "./contexts/BackgroundModeContext";

interface BackgroundToggleProps {
  size?: "sm" | "lg" | "default" | "icon";
  variant?: "ghost" | "outline" | "default";
  showLabel?: boolean;
  outerSidebarMode?: boolean; // New prop for outer sidebar styling
}

const FACADE_PRESETS = [
  { value: 'intense', label: 'Intense', description: 'Maximum saturation' },
  { value: 'purple-dream', label: 'Purple Dream', description: 'Like attached image' },
  { value: 'midnight', label: 'Midnight', description: 'Dark blue tones' },
  { value: 'ocean', label: 'Ocean', description: 'Blue water theme' },
  { value: 'lavender', label: 'Lavender', description: 'Light purple theme' },
] as const;

export function BackgroundToggle({ 
  size = "sm", 
  variant = "ghost",
  showLabel = false,
  outerSidebarMode = false
}: BackgroundToggleProps) {
  const [mounted, setMounted] = useState(false);
  const { backgroundMode, facadePreset, setBackgroundMode, setFacadePreset } = useBackgroundMode();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const iconSize = outerSidebarMode ? 22 : (size === "lg" ? 24 : size === "default" ? 20 : 16);

  // Outer sidebar mode uses custom styling to match other icons
  if (outerSidebarMode) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button 
            className="relative group"
            aria-label="Background Style"
          >
            <div 
              className="p-2.5 rounded-lg transition-all duration-300 text-muted-foreground hover:text-foreground"
              style={{
                minWidth: 44,
                minHeight: 44,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {backgroundMode === "image" ? (
                <Image 
                  size={iconSize} 
                  style={{
                    color: 'currentColor',
                    transition: 'color 0.3s ease'
                  }}
                />
              ) : (
                <Palette 
                  size={iconSize} 
                  style={{
                    color: 'currentColor',
                    transition: 'color 0.3s ease'
                  }}
                />
              )}
            </div>
            {/* Tooltip */}
            <div className="absolute left-14 top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-gray-900 text-white text-sm rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 whitespace-nowrap">
              Background
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-60 bg-gray-950 text-gray-100 border border-gray-800 rounded-lg shadow-xl font-medium" align="center" side="right" sideOffset={8}>
          <DropdownMenuSub>
            {/* IMPORTANT: Keep the Games trigger ICON-ONLY. Do NOT add any text labels here. */}
            <DropdownMenuSubTrigger className="flex items-center gap-3 cursor-pointer text-gray-300 hover:bg-gray-800 hover:text-gray-100">
              <Gamepad2 size={16} className="text-purple-400" />
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-56 bg-gray-950 text-gray-100 border border-gray-800">
              <DropdownMenuLabel className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                Available Games
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-gray-800" />
              <DropdownMenuItem 
                className="flex items-center gap-3 cursor-pointer text-gray-300 hover:bg-gray-800 hover:text-gray-100" 
                onClick={() => window.location.href = '/games/space-onvaders'}
              >
                <Rocket size={16} className="text-blue-400" />
                <div className="flex flex-col">
                  <span className="font-medium">Space Onvaders</span>
                  <span className="text-xs text-muted-foreground">
                    Defend Earth from invasion
                  </span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="flex items-center gap-3 cursor-pointer text-gray-300 hover:bg-gray-800 hover:text-gray-100" 
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
                className="flex items-center gap-3 cursor-pointer text-gray-300 hover:bg-gray-800 hover:text-gray-100" 
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
          <DropdownMenuLabel className="flex items-center gap-2 text-xs uppercase tracking-wider text-gray-400">
            <Layers size={14} className="text-muted-foreground" />
            Background Style
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-gray-800" />
          
          <DropdownMenuRadioGroup 
            value={backgroundMode} 
            onValueChange={(value) => setBackgroundMode(value as "image" | "facade")}
          >
          <DropdownMenuRadioItem 
              className="flex items-center gap-3 cursor-pointer text-gray-300 hover:bg-gray-800 hover:text-gray-100" 
              value="image"
            >
              <Image size={16} className="text-blue-500" />
              <div className="flex flex-col">
                <span>Image Backgrounds</span>
                <span className="text-xs text-muted-foreground">
                  Use themed image assets
                </span>
              </div>
            </DropdownMenuRadioItem>
            
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="flex items-center gap-3 cursor-pointer text-gray-300 hover:bg-gray-800 hover:text-gray-100">
                <Palette size={16} className="text-purple-500" />
                <div className="flex flex-col flex-1">
                  <span>Facade Backgrounds</span>
                  <span className="text-xs text-muted-foreground">
                    Dynamic gradient patterns
                  </span>
                </div>
                <ChevronRight size={16} className="text-muted-foreground" />
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-48 bg-gray-950 text-gray-100 border border-gray-800">
                <DropdownMenuRadioGroup 
                  value={facadePreset} 
                  onValueChange={(value) => {
                    setFacadePreset(value as any);
                    setBackgroundMode('facade');
                  }}
                >
                  {FACADE_PRESETS.map((preset) => (
                    <DropdownMenuRadioItem 
                      key={preset.value}
                      value={preset.value}
                      className="flex flex-col items-start gap-1 py-2 cursor-pointer text-gray-300 hover:bg-gray-800 hover:text-gray-100"
                    >
                      <span className="font-medium">{preset.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {preset.description}
                      </span>
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Regular mode using Button component
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} className="flex items-center gap-2">
          {backgroundMode === "image" ? (
            <Image 
              size={iconSize} 
              className="text-muted-foreground" 
            />
          ) : (
            <Palette 
              size={iconSize} 
              className="text-muted-foreground" 
            />
          )}
          {showLabel && (
            <span className="hidden sm:inline">
              {backgroundMode === "image" ? "Image" : "Facade"}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-60 bg-gray-950 text-gray-100 border border-gray-800 rounded-lg shadow-xl font-medium" align="center">
        <DropdownMenuSub>
          {/* IMPORTANT: Keep the Games trigger ICON-ONLY. Do NOT add any text labels here. */}
          <DropdownMenuSubTrigger className="flex items-center gap-3 cursor-pointer text-gray-300 hover:bg-gray-800 hover:text-gray-100">
            <Gamepad2 size={16} className="text-purple-400" />
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-56 bg-gray-950 text-gray-100 border border-gray-800">
            <DropdownMenuLabel className="text-xs font-medium text-gray-400 uppercase tracking-wider">
              Available Games
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-gray-800" />
            <DropdownMenuItem 
              className="flex items-center gap-3 cursor-pointer text-gray-300 hover:bg-gray-800 hover:text-gray-100" 
              onClick={() => window.location.href = '/games/space-onvaders'}
            >
              <Rocket size={16} className="text-blue-400" />
              <div className="flex flex-col">
                <span className="font-medium">Space Onvaders</span>
                <span className="text-xs text-muted-foreground">
                  Defend Earth from invasion
                </span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem 
              className="flex items-center gap-3 cursor-pointer text-gray-300 hover:bg-gray-800 hover:text-gray-100" 
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
              className="flex items-center gap-3 cursor-pointer text-gray-300 hover:bg-gray-800 hover:text-gray-100" 
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
        <DropdownMenuLabel className="flex items-center gap-2 text-xs uppercase tracking-wider text-gray-400">
          <Layers size={14} className="text-muted-foreground" />
          Background Style
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-gray-800" />
        
        <DropdownMenuRadioGroup 
          value={backgroundMode} 
          onValueChange={(value) => setBackgroundMode(value as "image" | "facade")}
        >
          <DropdownMenuRadioItem 
            className="flex items-center gap-3 cursor-pointer text-gray-300 hover:bg-gray-800 hover:text-gray-100" 
            value="image"
          >
            <Image size={16} className="text-muted-foreground" />
            <div className="flex flex-col">
              <span>Image Backgrounds</span>
              <span className="text-xs text-muted-foreground">
                Use themed image assets
              </span>
            </div>
          </DropdownMenuRadioItem>
          
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="flex items-center gap-3 cursor-pointer text-gray-300 hover:bg-gray-800 hover:text-gray-100">
              <Palette size={16} className="text-purple-500" />
              <div className="flex flex-col flex-1">
                <span>CSS Facades</span>
                <span className="text-xs text-muted-foreground">
                  Current: {FACADE_PRESETS.find(p => p.value === facadePreset)?.label}
                </span>
              </div>
              <ChevronRight size={12} className="text-muted-foreground" />
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-64 bg-gray-950 text-gray-100 border border-gray-800">
              <DropdownMenuLabel className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                Choose Facade Style
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-gray-800" />
              <DropdownMenuRadioGroup 
                value={facadePreset} 
                onValueChange={(value) => {
                  setFacadePreset(value as any);
                  setBackgroundMode('facade');
                }}
              >
                {FACADE_PRESETS.map((preset) => (
                  <DropdownMenuRadioItem 
                    key={preset.value}
                    value={preset.value}
                    className="flex flex-col items-start gap-1 py-2 cursor-pointer text-gray-300 hover:bg-gray-800 hover:text-gray-100"
                  >
                    <span className="font-medium">{preset.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {preset.description}
                    </span>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
