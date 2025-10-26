// Table Search Settings Hook
import { useState, useEffect } from 'react';
import { TableSearchSettings } from '@/lib/types';

// Local storage key for persisting settings
const STORAGE_KEY = 'tableSearchSettings';

// Default settings - UPDATED to prevent context overflow (max 50 results to avoid exceeding model context)
const DEFAULT_SETTINGS: TableSearchSettings = {
  searchMode: 'basic',
  targetTable: 'all',
  projectId: undefined, // Will be set from global context
  maxTablesSearched: 5,
  maxRowsPerTable: 200,
  maxResultsReturned: 50, // CRITICAL: Reduced from 200 to prevent context length errors
  enableSemanticMatching: true,
  prioritizeRecentData: true,
  includeSystemTables: false,
};

export function useTableSearchSettings() {
  const [settings, setSettings] = useState<TableSearchSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load settings from localStorage on mount with migration
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsedSettings = JSON.parse(saved);
        
        // MIGRATION: Fix dangerously high old settings
        const migratedSettings = { ...DEFAULT_SETTINGS, ...parsedSettings };
        
        // Cap maxResultsReturned to prevent context overflow
        if (migratedSettings.maxResultsReturned > 500) {
          console.warn(`[TableSearchSettings] Migrating maxResultsReturned from ${migratedSettings.maxResultsReturned} to 300 (context safety)`);
          migratedSettings.maxResultsReturned = 300;
          migratedSettings.searchMode = 'custom';
        }
        
        // Cap maxRowsPerTable
        if (migratedSettings.maxRowsPerTable > 5000) {
          console.warn(`[TableSearchSettings] Migrating maxRowsPerTable from ${migratedSettings.maxRowsPerTable} to 2000`);
          migratedSettings.maxRowsPerTable = 2000;
          migratedSettings.searchMode = 'custom';
        }
        
        // Save migrated settings back
        if (migratedSettings.maxResultsReturned !== parsedSettings.maxResultsReturned ||
            migratedSettings.maxRowsPerTable !== parsedSettings.maxRowsPerTable) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(migratedSettings));
        }
        
        setSettings(migratedSettings);
      }
    } catch (error) {
      // Fall back to defaults on any error
      setSettings(DEFAULT_SETTINGS);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Save settings to localStorage when they change (persist everything including projectId)
  const updateSettings = (newSettings: TableSearchSettings) => {
    setSettings(newSettings);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
    } catch (error) {
      // silent
    }
  };

  // Convert settings to API parameters (ensuring correct property mapping)
  const getApiParams = () => ({
    targetTable: settings.targetTable, // NEW: Include target table selection
    maxTableRows: settings.maxRowsPerTable, // Map to API expected property name
    maxTablesSearched: settings.targetTable !== 'all' ? 1 : settings.maxTablesSearched, // Force 1 table if specific table selected
    maxResultsReturned: settings.maxResultsReturned,
    enableSemanticMatching: settings.enableSemanticMatching,
    prioritizeRecentData: settings.prioritizeRecentData,
    includeSystemTables: settings.includeSystemTables,
  });

  // Get performance indication
  const getPerformanceLevel = (): 'fast' | 'balanced' | 'thorough' | 'intensive' => {
    const complexity = (settings.maxTablesSearched * settings.maxRowsPerTable) / 1000;
    if (complexity < 1) return 'fast';
    if (complexity < 5) return 'balanced';
    if (complexity < 15) return 'thorough';
    return 'intensive';
  };

  // Reset to defaults
  const resetToDefaults = () => {
    setSettings(DEFAULT_SETTINGS);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS));
    } catch (error) {
      // Silent fail
    }
  };

  // Clear old cached settings (migration helper)
  const clearCache = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      setSettings(DEFAULT_SETTINGS);
    } catch (error) {
      // Silent fail
    }
  };

  return {
    settings,
    updateSettings,
    getApiParams,
    getPerformanceLevel,
    isLoaded,
    resetToDefaults,
    clearCache,
  };
}
