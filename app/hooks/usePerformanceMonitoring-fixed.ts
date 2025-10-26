// hooks/usePerformanceMonitoring-fixed.ts
'use client';

// Backwards-compatible alias to the new minimal monitor
import {
  usePerformanceMonitoring as usePerformanceMonitoringBase,
} from './usePerformanceMonitoring';

export type {
  UsePerformanceMonitoringResult,
  PerformanceMetric,
  PerformanceSession,
} from './usePerformanceMonitoring';

export function usePerformanceMonitoringFixed() {
  return usePerformanceMonitoringBase();
}

