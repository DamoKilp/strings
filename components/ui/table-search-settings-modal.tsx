// Table Search Settings Modal Component - Redesigned to match Agent Manager Dialog
'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContentGlass, DialogHeaderGlass, DialogFooterGlass, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Settings, Database, Clock, Zap, Info, Save, RotateCcw, BookOpen, AlertCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TableSearchSettings } from '@/lib/types';
// DataWorkbench removed; project selection disabled
// TableSearchLayout kept local
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import TableSearchLayout from '@/components/ui/TableSearchLayout';

// Default presets - UPDATED to prevent context overflow
// NOTE: maxResultsReturned is the critical limit to prevent exceeding model context windows
const SEARCH_PRESETS = {
  basic: {
    label: 'Basic',
    description: 'Fast exploration with key insights',
    icon: <Zap className="w-4 h-4" />,
    settings: {
      targetTable: 'all',
      maxTablesSearched: 5,
      maxRowsPerTable: 200,
      maxResultsReturned: 50, // REDUCED from 200 to prevent context overflow
      enableSemanticMatching: true,
      prioritizeRecentData: true,
      includeSystemTables: false,
    },
    estimatedTime: '5-10 seconds',
    color: 'bg-green-500'
  },
  thorough: {
    label: 'Thorough',
    description: 'Balanced coverage and detail',
    icon: <Database className="w-4 h-4" />,
    settings: {
      targetTable: 'all',
      maxTablesSearched: 8,
      maxRowsPerTable: 500,
      maxResultsReturned: 150, // REDUCED from 500 to prevent context overflow
      enableSemanticMatching: true,
      prioritizeRecentData: true,
      includeSystemTables: false,
    },
    estimatedTime: '15-30 seconds',
    color: 'bg-blue-500'
  },
  deep: {
    label: 'Deep',
    description: 'Comprehensive analysis with more data',
    icon: <Clock className="w-4 h-4" />,
    settings: {
      targetTable: 'all',
      maxTablesSearched: 12,
      maxRowsPerTable: 1000,
      maxResultsReturned: 300, // REDUCED from 2000 to prevent context overflow
      enableSemanticMatching: true,
      prioritizeRecentData: false,
      includeSystemTables: true,
    },
    estimatedTime: '30-60 seconds',
    color: 'bg-amber-500'
  },
  exhaustive: {
    label: 'Exhaustive',
    description: 'Maximum detail - use with caution',
    icon: <Zap className="w-4 h-4" />,
    settings: {
      targetTable: 'all',
      maxTablesSearched: 15,
      maxRowsPerTable: 2000,
      maxResultsReturned: 500, // CAPPED at 500 - prevents 1M char context overflow
      enableSemanticMatching: true,
      prioritizeRecentData: false,
      includeSystemTables: true,
    },
    estimatedTime: '1-2 minutes',
    color: 'bg-red-500'
  }
} as const;

interface TableSearchSettingsModalProps {
  currentSettings: TableSearchSettings;
  onSettingsChange: (settings: TableSearchSettings) => void;
  children?: React.ReactNode;
}

export function TableSearchSettingsModal({ 
  currentSettings, 
  onSettingsChange, 
  children 
}: TableSearchSettingsModalProps) {
  const [settings, setSettings] = useState<TableSearchSettings>(currentSettings);
  const [isOpen, setIsOpen] = useState(false);
  const [availableTables, setAvailableTables] = useState<Array<{name: string, display_name: string}>>([]);
  const [loadingTables, setLoadingTables] = useState(false);
  const globalSelectedProjectId = null as unknown as string | null;
  
  // Local project selection state (separate from global context)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(globalSelectedProjectId);
  const [availableProjects, setAvailableProjects] = useState<Array<{id: string, name: string}>>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  // Sync internal settings when currentSettings prop changes
  useEffect(() => {
    setSettings(currentSettings);
  }, [currentSettings]);

  // Initialize project selection from persisted settings, fallback to global
  useEffect(() => {
    if (isOpen) {
      const persistedProject = currentSettings.projectId || null;
      setSelectedProjectId(persistedProject ?? globalSelectedProjectId);
      // Re-select last-used preset if available
      try {
        const lastPreset = localStorage.getItem('tableSearchLastPreset') as keyof typeof SEARCH_PRESETS | null;
        if (lastPreset && SEARCH_PRESETS[lastPreset]) {
          setSettings(prev => ({
            ...prev,
            searchMode: lastPreset as TableSearchSettings['searchMode'],
            ...SEARCH_PRESETS[lastPreset].settings,
          }));
        }
      } catch {}
    }
  }, [isOpen, globalSelectedProjectId, currentSettings.projectId]);

  // Fetch available projects when modal opens
  useEffect(() => {
    if (isOpen && availableProjects.length === 0 && !loadingProjects) {
      fetchAvailableProjects();
    }
  }, [isOpen, availableProjects.length, loadingProjects]);

  // Fetch available tables when modal opens or project changes
  useEffect(() => {
    if (isOpen && selectedProjectId) {
      fetchAvailableTables();
      // Reset table selection to 'all' when project changes
      if (settings.targetTable !== 'all') {
        setSettings(prev => ({ ...prev, targetTable: 'all' }));
      }
    }
  }, [isOpen, selectedProjectId]);

  // Auto-refresh lists when schema changes (if modal is open)
  useEffect(() => {
    const handler = () => {
      if (isOpen) {
        fetchAvailableProjects();
        if (selectedProjectId) {
          fetchAvailableTables();
        }
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('schema:changed', handler as EventListener);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('schema:changed', handler as EventListener);
      }
    }
  }, [isOpen, selectedProjectId]);

  // Fetch available projects
  const fetchAvailableProjects = async () => {
    setLoadingProjects(true);
    try {
      setAvailableProjects([]);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
      setAvailableProjects([]);
    } finally {
      setLoadingProjects(false);
    }
  };

  // Fetch available tables from the dynamic_tables table for selected project
  const fetchAvailableTables = async () => {
    if (!selectedProjectId) {
      setAvailableTables([]);
      return;
    }
    
    setLoadingTables(true);
    try {
      setAvailableTables([]);
    } catch (error) {
      // Fallback to common table names if API fails
      setAvailableTables([
        { name: 'dynamic_fm_crs_2025', display_name: 'FM CRS 2025' },
        { name: 'dynamic_assets_234234', display_name: 'Assets Database' },
        { name: 'dynamic_components_2025', display_name: 'Components 2025' },
        { name: 'dynamic_asset_management_plan_cost', display_name: 'Asset Management Cost Plans' },
        { name: 'dynamic_projects', display_name: 'Project Registry' },
        { name: 'dynamic_tables', display_name: 'Table Metadata' }
      ]);
    } finally {
      setLoadingTables(false);
    }
  };

  // Calculate estimated search time based on settings
  const calculateEstimatedTime = (settings: TableSearchSettings): string => {
    const effectiveTablesSearched = settings.targetTable !== 'all' ? 1 : settings.maxTablesSearched;
    const dataPoints = effectiveTablesSearched * settings.maxRowsPerTable;
    
    if (dataPoints < 2000) return '5-10 seconds';
    if (dataPoints < 10000) return '10-20 seconds';
    if (dataPoints < 30000) return '20-40 seconds';
    if (dataPoints < 80000) return '40-80 seconds';
    if (dataPoints < 150000) return '60-120 seconds';
    if (dataPoints < 250000) return '120-180 seconds (2-3 minutes)';
    return '180+ seconds (3+ minutes)';
  };

  // Calculate total data points that will be analyzed
  const calculateDataPoints = (settings: TableSearchSettings): number => {
    const effectiveTablesSearched = settings.targetTable !== 'all' ? 1 : settings.maxTablesSearched;
    return effectiveTablesSearched * settings.maxRowsPerTable;
  };

  // Apply preset configuration
  const applyPreset = (presetKey: keyof typeof SEARCH_PRESETS) => {
    const preset = SEARCH_PRESETS[presetKey];
    setSettings({
      ...settings,
      searchMode: presetKey as TableSearchSettings['searchMode'],
      ...preset.settings,
      projectId: selectedProjectId || undefined // Keep selected project
    });
    // Persist last-used preset for future sessions
    try {
      localStorage.setItem('tableSearchLastPreset', presetKey);
    } catch {}
  };

  // Save settings and close modal
  const handleSave = () => {
    // Include selected project in settings
    const settingsToSave = {
      ...settings,
      projectId: selectedProjectId || undefined
    };
    onSettingsChange(settingsToSave);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              {children || (
                <Button variant="outline" size="sm">
                  <Settings className="w-4 h-4 mr-2" />
                  Table Search Settings
                </Button>
              )}
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={4} className="toolbar-tooltip !bg-slate-900 !text-slate-200 border border-slate-700 pointer-events-none">
            <div className="flex flex-col">
              <span className="font-semibold">Table Search Settings</span>
              <span className="text-xs opacity-80">Configure table scope and limits</span>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
        
      <DialogContentGlass className="h-[90vh] max-h-[90vh]">
        <DialogHeaderGlass>
          <div className="flex items-center justify-between gap-3">
            <div>
              <DialogTitle className="text-lg sm:text-xl font-semibold glass-text-primary">
                Table Search Settings
              </DialogTitle>
              <p className="text-xs sm:text-sm glass-text-secondary mt-1">
                Configure search scope and result limits
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="glass"
                className="glass-small glass-interactive h-9 px-3 rounded-xl"
                onClick={() => setIsGuideOpen(true)}
              >
                <BookOpen className="mr-2 h-4 w-4" />
                How Table Search Works
              </Button>
              <Button
                variant="glass"
                className="glass-small glass-interactive h-9 px-3 rounded-xl"
                onClick={() => setSettings(currentSettings)}
                disabled={JSON.stringify(settings) === JSON.stringify(currentSettings)}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset
              </Button>
              <Button
                variant="glass"
                className="glass-small glass-interactive h-9 px-3 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/20 hover:from-blue-500/30 hover:to-blue-600/30"
                onClick={handleSave}
              >
                <Save className="mr-2 h-4 w-4" />
                Apply Settings
              </Button>
            </div>
          </div>
        </DialogHeaderGlass>
        
        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto min-h-0">

        <TableSearchLayout
          left={(
            <div className="space-y-2 px-4">
              {Object.entries(SEARCH_PRESETS).map(([key, preset]) => {
                const isSelected = settings.searchMode === key;
                return (
                  <div
                    key={key}
                    className={`
                      p-4 border rounded-lg cursor-pointer transition-all
                      ${isSelected
                        ? 'border-primary bg-primary/10 ring-2 ring-primary/20 shadow-md' 
                        : 'border-border hover:border-primary/50 hover:bg-primary/5'
                      }
                    `}
                    onClick={() => applyPreset(key as keyof typeof SEARCH_PRESETS)}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-3 h-3 rounded-full ${preset.color}`} />
                      <span className="font-semibold text-sm">{preset.label}</span>
                      {isSelected && (
                        <Badge variant="secondary" className="ml-auto text-xs">Active</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">
                      {preset.description}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {preset.icon}
                      <span>~{preset.estimatedTime}</span>
                    </div>
                  </div>
                );
              })}

              {/* Current Settings Summary */}
              {settings.searchMode === 'custom' && (
                <div className="mt-4 p-4 border border-purple-300 bg-purple-50/50 dark:border-purple-700 dark:bg-purple-950/30 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Settings className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span className="font-semibold text-sm">Custom Configuration</span>
                  </div>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Tables:</span>
                      <span className="font-medium">{settings.targetTable !== 'all' ? 1 : settings.maxTablesSearched}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Rows/Table:</span>
                      <span className="font-medium">{settings.maxRowsPerTable}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Max Results:</span>
                      <span className="font-medium">{settings.maxResultsReturned}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t">
                      <span>Est. Time:</span>
                      <span className="font-medium">{calculateEstimatedTime(settings)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          right={(
            <div className="space-y-6">
              {/* Project Selection Section */}
              <div>
                <div className="rightpane-card-title mb-1">Project Selection</div>
                <div className="rightpane-card-subtitle mb-3">
                  Select the project to search within. Tables will be filtered based on your selection.
                </div>
                <div className="space-y-3">
                  <Label htmlFor="projectSelect" className="text-sm font-medium">Project</Label>
                  <Select
                    value={selectedProjectId || 'none'}
                    onValueChange={(value) => {
                      setSelectedProjectId(value === 'none' ? null : value);
                      // Reset table selection when project changes
                      setSettings(prev => ({ ...prev, targetTable: 'all' }));
                    }}
                  >
                    <SelectTrigger id="projectSelect">
                      <SelectValue placeholder="Select a project..." />
                    </SelectTrigger>
                    <SelectContent>
                      {loadingProjects ? (
                        <SelectItem value="loading" disabled>
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 animate-spin" />
                            Loading projects...
                          </div>
                        </SelectItem>
                      ) : availableProjects.length === 0 ? (
                        <SelectItem value="none" disabled>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Info className="w-4 h-4" />
                            No projects available
                          </div>
                        </SelectItem>
                      ) : (
                        availableProjects.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            <div className="flex items-center gap-2">
                              <Database className="w-4 h-4" />
                              {project.name}
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {selectedProjectId 
                      ? `Searching within tables from this project`
                      : 'Please select a project to view available tables'
                    }
                  </p>
                </div>
              </div>

              {/* Table Targeting Section */}
              <div>
                <div className="rightpane-card-title mb-1">Table Targeting</div>
                <div className="rightpane-card-subtitle mb-3">
                  Search all tables in the project or focus on a specific table for deeper analysis.
                </div>
                <div className="space-y-3">
                  <Label htmlFor="targetTable" className="text-sm font-medium">Target Table</Label>
                  <Select
                    value={settings.targetTable}
                    onValueChange={(value) => {
                      const newSettings = { 
                        ...settings, 
                        targetTable: value,
                        searchMode: 'custom' as const
                      };
                      
                      if (value !== 'all') {
                        newSettings.maxTablesSearched = 1;
                        newSettings.maxRowsPerTable = Math.max(settings.maxRowsPerTable, 5000);
                        newSettings.maxResultsReturned = Math.max(settings.maxResultsReturned, 1000);
                      }
                      
                      setSettings(newSettings);
                    }}
                    disabled={!selectedProjectId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={selectedProjectId ? "Select target table..." : "Select a project first"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        <div className="flex items-center gap-2">
                          <Database className="w-4 h-4" />
                          All Tables in Project
                        </div>
                      </SelectItem>
                      {loadingTables ? (
                        <SelectItem value="loading" disabled>
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 animate-spin" />
                            Loading tables...
                          </div>
                        </SelectItem>
                      ) : availableTables.length === 0 ? (
                        <SelectItem value="none" disabled>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Info className="w-4 h-4" />
                            No tables in this project
                          </div>
                        </SelectItem>
                      ) : (
                        availableTables.map((table) => (
                          <SelectItem key={table.name} value={table.name}>
                            <div className="flex items-center gap-2">
                              <Database className="w-4 h-4" />
                              {table.display_name}
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {!selectedProjectId 
                      ? 'Select a project above to view available tables'
                      : settings.targetTable === 'all' 
                        ? 'Searching across all tables in the selected project'
                        : `Focused search on ${settings.targetTable} - higher row limits available`
                    }
                  </p>
                </div>
              </div>

              {/* Advanced Parameters Section */}
              <div>
                <div className="rightpane-card-title mb-1">Advanced Parameters</div>
                <div className="rightpane-card-subtitle mb-3">
                  Fine-tune search parameters for your specific needs.
                </div>
                
                <div className="space-y-4">
                  {/* Tables Searched */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="maxTables" className="text-sm font-medium">
                        Tables Searched
                        {settings.targetTable !== 'all' && (
                          <span className="text-xs text-muted-foreground ml-2">(Fixed to 1)</span>
                        )}
                      </Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="w-4 h-4 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>How many tables to search through.</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <div className="flex items-center gap-4">
                      <Slider
                        id="maxTables"
                        min={1}
                        max={25}
                        step={1}
                        disabled={settings.targetTable !== 'all'}
                        value={[settings.targetTable !== 'all' ? 1 : settings.maxTablesSearched]}
                        onValueChange={(value) => 
                          setSettings({ ...settings, maxTablesSearched: value[0], searchMode: 'custom' })
                        }
                        className="flex-1"
                      />
                      <Input
                        type="number"
                        disabled={settings.targetTable !== 'all'}
                        value={settings.targetTable !== 'all' ? 1 : settings.maxTablesSearched}
                        onChange={(e) => 
                          setSettings({ 
                            ...settings, 
                            maxTablesSearched: parseInt(e.target.value) || 1,
                            searchMode: 'custom'
                          })
                        }
                        className="w-20"
                        min={1}
                        max={25}
                      />
                    </div>
                  </div>

                  {/* Rows Per Table */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="maxRows" className="text-sm font-medium">Rows Per Table</Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="w-4 h-4 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>How many rows to analyze from each table.</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <div className="flex items-center gap-4">
                      <Slider
                        id="maxRows"
                        min={10}
                        max={5000}
                        step={50}
                        value={[settings.maxRowsPerTable]}
                        onValueChange={(value) => 
                          setSettings({ ...settings, maxRowsPerTable: value[0], searchMode: 'custom' })
                        }
                        className="flex-1"
                      />
                      <Input
                        type="number"
                        value={settings.maxRowsPerTable}
                        onChange={(e) => 
                          setSettings({ 
                            ...settings, 
                            maxRowsPerTable: parseInt(e.target.value) || 11,
                            searchMode: 'custom'
                          })
                        }
                        className="w-20"
                        min={10}
                        max={10000}
                        step={50}
                      />
                    </div>
                  </div>

                  {/* Results Returned */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="maxResults" className="text-sm font-medium">Results Returned</Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="w-4 h-4 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Maximum number of matching rows returned.</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <div className="flex items-center gap-4">
                      <Slider
                        id="maxResults"
                        min={5}
                        max={5000}
                        step={25}
                        value={[settings.maxResultsReturned]}
                        onValueChange={(value) => 
                          setSettings({ ...settings, maxResultsReturned: value[0], searchMode: 'custom' })
                        }
                        className="flex-1"
                      />
                      <Input
                        type="number"
                        value={settings.maxResultsReturned}
                        onChange={(e) => 
                          setSettings({ 
                            ...settings, 
                            maxResultsReturned: parseInt(e.target.value) || 3,
                            searchMode: 'custom'
                          })
                        }
                        className="w-20"
                        min={5}
                        max={5000}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Search Options Section */}
              <div>
                <div className="rightpane-card-title mb-1">Search Options</div>
                <div className="rightpane-card-subtitle mb-3">
                  Enable advanced search features for better results.
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label htmlFor="semantic" className="text-sm font-medium">Smart Semantic Matching</Label>
                      <p className="text-xs text-muted-foreground">
                        Use AI to find related terms and concepts
                      </p>
                    </div>
                    <Switch
                      id="semantic"
                      checked={settings.enableSemanticMatching}
                      onCheckedChange={(checked) => 
                        setSettings({ ...settings, enableSemanticMatching: checked, searchMode: 'custom' })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label htmlFor="recent" className="text-sm font-medium">Prioritize Recent Data</Label>
                      <p className="text-xs text-muted-foreground">
                        Give higher weight to recently updated records
                      </p>
                    </div>
                    <Switch
                      id="recent"
                      checked={settings.prioritizeRecentData}
                      onCheckedChange={(checked) => 
                        setSettings({ ...settings, prioritizeRecentData: checked, searchMode: 'custom' })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label htmlFor="system" className="text-sm font-medium">Include System Tables</Label>
                      <p className="text-xs text-muted-foreground">
                        Search internal/administrative tables
                      </p>
                    </div>
                    <Switch
                      id="system"
                      checked={settings.includeSystemTables}
                      onCheckedChange={(checked) => 
                        setSettings({ ...settings, includeSystemTables: checked, searchMode: 'custom' })
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Performance Impact Section */}
              <div className={`p-4 border rounded-lg ${
                settings.maxResultsReturned > 500 
                  ? 'border-red-400 bg-red-50/50 dark:border-red-700 dark:bg-red-950/30'
                  : settings.maxResultsReturned > 300
                    ? 'border-orange-400 bg-orange-50/50 dark:border-orange-700 dark:bg-orange-950/30'
                    : 'border-amber-300 bg-amber-50/50 dark:border-amber-700 dark:bg-amber-950/30'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <Clock className={`w-4 h-4 ${
                    settings.maxResultsReturned > 500 
                      ? 'text-red-600 dark:text-red-400'
                      : settings.maxResultsReturned > 300
                        ? 'text-orange-600 dark:text-orange-400'
                        : 'text-amber-600 dark:text-amber-400'
                  }`} />
                  <span className="font-semibold text-sm">
                    {settings.maxResultsReturned > 500 
                      ? '⚠️ Context Overflow Risk'
                      : settings.maxResultsReturned > 300
                        ? 'Performance Impact'
                        : 'Performance Impact'
                    }
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-xs mb-2">
                  <div>
                    <span className="text-muted-foreground">Estimated time:</span>
                    <div className="font-medium">{calculateEstimatedTime(settings)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Data points:</span>
                    <div className="font-medium">{calculateDataPoints(settings).toLocaleString()}</div>
                  </div>
                </div>
                {settings.maxResultsReturned > 500 && (
                  <div className="pt-2 border-t border-red-300 dark:border-red-700">
                    <p className="text-xs text-red-700 dark:text-red-300 font-medium">
                      ⚠️ Warning: Settings may exceed model context window (causing errors). Recommended: Keep "Results Returned" below 300.
                    </p>
                  </div>
                )}
                {settings.maxResultsReturned > 300 && settings.maxResultsReturned <= 500 && (
                  <div className="pt-2 border-t border-orange-300 dark:border-orange-700">
                    <p className="text-xs text-orange-700 dark:text-orange-300">
                      ⚡ Caution: High result count may cause slower responses or context limits with some models.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        />
        </div>
        
        {/* Footer */}
        <DialogFooterGlass>
          <Button 
            variant="glass" 
            onClick={() => setIsOpen(false)}
            className="glass-small glass-interactive px-6 rounded-xl"
          >
            Cancel
          </Button>
          <Button
            variant="glass"
            className="glass-small glass-interactive px-6 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/20 hover:from-blue-500/30 hover:to-blue-600/30"
            onClick={handleSave}
          >
            <Save className="mr-2 h-4 w-4" />
            Apply Settings
          </Button>
        </DialogFooterGlass>
        
        {/* Information Guide Sheet */}
        <Sheet open={isGuideOpen} onOpenChange={setIsGuideOpen}>
          <SheetContent side="right" className="w-[90vw] sm:max-w-xl">
            <SheetHeader>
              <SheetTitle>How Table Search Works</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-5 pr-1 custom-scrollbar overflow-y-auto h-[calc(100dvh-9rem)]">
              
              {/* What is Table Search */}
              <section className="space-y-2">
                <h3 className="text-base font-semibold flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  What is Table Search?
                </h3>
                <p className="text-sm text-muted-foreground">
                  Table Search lets the AI access your actual database tables to answer questions with real data. Instead of just using its training knowledge, the AI can search through your components, assets, maintenance records, and other tables to provide accurate, data-backed answers.
                </p>
              </section>

              {/* How It Works */}
              <section className="space-y-2">
                <h3 className="text-base font-semibold flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  How It Works (Simple Explanation)
                </h3>
                <ol className="list-decimal pl-5 text-sm space-y-2">
                  <li>
                    <span className="font-medium">You ask a question</span> - Example: "Show me all pumps in Building 3"
                  </li>
                  <li>
                    <span className="font-medium">AI searches your tables</span> - Looks through components, assets, etc. to find relevant rows
                  </li>
                  <li>
                    <span className="font-medium">Results are sent to AI</span> - Only matching rows are included (not entire tables)
                  </li>
                  <li>
                    <span className="font-medium">AI analyzes and responds</span> - Uses your real data to answer accurately
                  </li>
                </ol>
              </section>

              {/* Advantages */}
              <section className="space-y-2">
                <h3 className="text-base font-semibold flex items-center gap-2 text-green-600 dark:text-green-400">
                  ✅ Advantages
                </h3>
                <ul className="list-disc pl-5 text-sm space-y-1">
                  <li><span className="font-medium">Accurate answers:</span> AI uses your actual data, not assumptions</li>
                  <li><span className="font-medium">Real-time:</span> Always searches current data, not outdated information</li>
                  <li><span className="font-medium">Comprehensive:</span> Can search across multiple tables at once</li>
                  <li><span className="font-medium">Project-scoped:</span> Only searches tables from your selected project</li>
                  <li><span className="font-medium">Smart ranking:</span> Results are sorted by relevance to your question</li>
                </ul>
              </section>

              {/* Limitations */}
              <section className="space-y-2">
                <h3 className="text-base font-semibold flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <AlertCircle className="w-4 h-4" />
                  Limitations & Context Window
                </h3>
                <p className="text-sm text-muted-foreground mb-2">
                  AI models have a "context window" - a limit on how much text they can process at once. Table search results count toward this limit.
                </p>
                <ul className="list-disc pl-5 text-sm space-y-1">
                  <li><span className="font-medium">Context limit:</span> Most models can handle ~200,000 characters total</li>
                  <li><span className="font-medium">Too many results = errors:</span> If you request 1000 rows, you might exceed the limit</li>
                  <li><span className="font-medium">Slower with more data:</span> More tables/rows = longer search time</li>
                  <li><span className="font-medium">Not full-table access:</span> Only searches up to the row limit you set</li>
                </ul>
              </section>

              {/* Presets Explained */}
              <section className="space-y-2">
                <h3 className="text-base font-semibold flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  Understanding Presets
                </h3>
                <div className="space-y-3">
                  <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span className="font-medium text-sm">Basic (Recommended)</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Fast and safe. Searches 5 tables with 50 results. Perfect for most questions. Very low risk of context overflow.
                    </p>
                  </div>
                  
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                      <span className="font-medium text-sm">Thorough</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Balanced approach. Searches 8 tables with 150 results. Good for complex questions. Moderate risk.
                    </p>
                  </div>
                  
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2 h-2 rounded-full bg-amber-500" />
                      <span className="font-medium text-sm">Deep</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Comprehensive search. 12 tables with 300 results. Use when you need very detailed answers. Higher risk.
                    </p>
                  </div>
                  
                  <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2 h-2 rounded-full bg-red-500" />
                      <span className="font-medium text-sm">Exhaustive (Caution)</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Maximum data extraction. 15 tables with 500 results. May cause context overflow errors with some models. Use carefully!
                    </p>
                  </div>
                </div>
              </section>

              {/* Best Practices */}
              <section className="space-y-2">
                <h3 className="text-base font-semibold">Best Practices</h3>
                <ul className="list-disc pl-5 text-sm space-y-1">
                  <li><span className="font-medium">Start small:</span> Use "Basic" preset first, increase only if needed</li>
                  <li><span className="font-medium">Select your project:</span> Always choose a project to get relevant results</li>
                  <li><span className="font-medium">Target specific tables:</span> If you know which table has the data, select it directly</li>
                  <li><span className="font-medium">Watch the warnings:</span> Red warnings mean you're likely to hit errors</li>
                  <li><span className="font-medium">Keep results under 300:</span> This is the sweet spot for most models</li>
                </ul>
              </section>

              {/* Technical Details */}
              <section className="space-y-2">
                <h3 className="text-base font-semibold">Behind the Scenes (Technical)</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  For those interested in how it works:
                </p>
                <ul className="list-disc pl-5 text-sm space-y-1 text-muted-foreground">
                  <li>Uses PostgreSQL Full-Text Search (FTS) with GIN indexes for 10-100x faster queries</li>
                  <li>Smart summarization reduces data size by 80-90% while keeping key information</li>
                  <li>Caches results for 5 minutes for instant repeat queries</li>
                  <li>Project-scoped filtering ensures you only see your project's data</li>
                  <li>Automatic fallback if FTS isn't available on a table</li>
                </ul>
              </section>

              {/* Troubleshooting */}
              <section className="space-y-2">
                <h3 className="text-base font-semibold flex items-center gap-2 text-orange-600 dark:text-orange-400">
                  <AlertCircle className="w-4 h-4" />
                  Troubleshooting
                </h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium">❌ "Context length exceeded" error</p>
                    <p className="text-xs text-muted-foreground">
                      Your settings are too high. Reduce "Results Returned" to 50-150 and try again.
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">🐌 Search is very slow</p>
                    <p className="text-xs text-muted-foreground">
                      You're searching too many tables or rows. Use "Basic" preset or select a specific table.
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">📭 No results found</p>
                    <p className="text-xs text-muted-foreground">
                      Check that you've selected the correct project and that your tables have data.
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">🔄 Old settings still showing</p>
                    <p className="text-xs text-muted-foreground">
                      Clear your browser cache or use the Reset button to start fresh.
                    </p>
                  </div>
                </div>
              </section>

              {/* Quick Tips */}
              <section className="space-y-2">
                <h3 className="text-base font-semibold">Quick Tips</h3>
                <div className="space-y-2">
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-sm">
                      💡 <span className="font-medium">Pro tip:</span> For specific questions like "Find pump in Building 3", select the components table directly instead of searching all tables. This is faster and more accurate.
                    </p>
                  </div>
                  <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg border border-purple-200 dark:border-purple-800">
                    <p className="text-sm">
                      💡 <span className="font-medium">Performance tip:</span> The system automatically uses smart indexes and summarization to keep searches fast and prevent errors.
                    </p>
                  </div>
                  <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                    <p className="text-sm">
                      💡 <span className="font-medium">Context tip:</span> Results are automatically summarized to show only relevant fields, so you can get more results without hitting limits.
                    </p>
                  </div>
                </div>
              </section>

            </div>
          </SheetContent>
        </Sheet>
      </DialogContentGlass>
    </Dialog>
  );
}

export default TableSearchSettingsModal;
