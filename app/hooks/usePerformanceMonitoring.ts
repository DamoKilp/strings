// hooks/usePerformanceMonitoring.ts
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// New minimal performance monitor (replacing legacy monitor)
// - Lightweight collection of key metrics (LCP, CLS, INP, TTFB, load time)
// - No RBAC, contexts, or heavy UI coupling
// - Stable hooks and dependencies to prevent infinite loops

export type PerfType = 'navigation' | 'component' | 'database' | 'resource' | 'vitals';
export type PerfUnit = 'ms' | 'bytes' | 'count' | 'score';

import type { Json } from '@/lib/database.types';

export interface PerformanceMetric {
  id: string;
  timestamp: number;
  type: PerfType;
  category: string;
  name: string;
  value: number;
  unit: PerfUnit;
  metadata?: Json | null;
}

export interface PerformanceSession {
  sessionId: string;
  startTime: number;
  userAgent: string;
  url: string;
}

export interface UsePerformanceMonitoringResult {
  metrics: PerformanceMetric[];
  session: PerformanceSession | null;
  isTracking: boolean;
  startTracking: () => void;
  stopTracking: () => void;
  clearMetrics: () => void;
  addCustomMetric: (metric: { type: PerfType; category: string; name: string; value: number; unit: PerfUnit; metadata?: unknown }) => void;
  trackComponentPerformance: (componentName: string, operation: string, durationMs: number) => void;
  trackDatabasePerformance: (queryName: string, durationMs: number, metadata?: Record<string, unknown>) => void;
}

export function usePerformanceMonitoring(): UsePerformanceMonitoringResult {
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([]);
  const [isTracking, setIsTracking] = useState(false);
  const [session, setSession] = useState<PerformanceSession | null>(null);

  const isTrackingRef = useRef(false);
  const vitalsUnsubRef = useRef<(() => void) | null>(null);
  const observersRef = useRef<PerformanceObserver[]>([]);

  const newId = useCallback(() => `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, []);

  const addMetric = useCallback((metric: Omit<PerformanceMetric, 'id' | 'timestamp'>) => {
    if (!isTrackingRef.current) return;
    const item: PerformanceMetric = { ...metric, id: newId(), timestamp: Date.now() };
    setMetrics(prev => [...prev, item]);
  }, [newId]);

  const trackNavigationNow = useCallback(() => {
    if (typeof window === 'undefined') return;
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (!nav) return;
    addMetric({
      type: 'navigation',
      category: 'timing',
      name: 'page_load_time',
      value: Math.max(0, nav.loadEventEnd - nav.fetchStart),
      unit: 'ms',
      metadata: {
        domContentLoaded: Math.max(0, nav.domContentLoadedEventEnd - nav.fetchStart),
        responseEnd: Math.max(0, nav.responseEnd - nav.startTime),
      },
    });

    // Add separate metrics for easier panel rendering
    addMetric({
      type: 'navigation',
      category: 'timing',
      name: 'dom_content_loaded',
      value: Math.max(0, nav.domContentLoadedEventEnd - nav.fetchStart),
      unit: 'ms',
    });
    addMetric({
      type: 'navigation',
      category: 'timing',
      name: 'response_end',
      value: Math.max(0, nav.responseEnd - nav.startTime),
      unit: 'ms',
    });
  }, [addMetric]);

  type WebVitalsHandler = (cb: (m: { name: string; value: number }) => void) => () => void;
  type WebVitalsModule = Partial<{
    onLCP: WebVitalsHandler;
    onCLS: WebVitalsHandler;
    onINP: WebVitalsHandler;
    onFCP: WebVitalsHandler;
    onTTFB: WebVitalsHandler;
  }>;

  const subscribeWebVitals = useCallback(async () => {
    if (typeof window === 'undefined') return () => {};
    try {
      const mod = (await import('next/dist/compiled/web-vitals')) as unknown as WebVitalsModule;
      const unsubs: Array<() => void> = [];

      const wrap = (name: string, unit: PerfUnit = 'ms') => (m: { name: string; value: number }) => {
        addMetric({ type: 'vitals', category: 'core_web_vitals', name, value: m.value, unit });
      };

      if (mod.onLCP) unsubs.push(mod.onLCP(wrap('LCP')));
      if (mod.onCLS) unsubs.push(mod.onCLS(wrap('CLS', 'score')));
      if (mod.onINP) unsubs.push(mod.onINP(wrap('INP')));
      if (mod.onFCP) unsubs.push(mod.onFCP(wrap('FCP')));
      if (mod.onTTFB) unsubs.push(mod.onTTFB(wrap('TTFB')));

      vitalsUnsubRef.current = () => { unsubs.forEach(u => { try { u(); } catch { /* noop */ } }); };
      return vitalsUnsubRef.current;
    } catch {
      return () => {};
    }
  }, [addMetric]);

  const observeLCPFallback = useCallback(() => {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) return;
    const po = new PerformanceObserver((list) => {
      const e = list.getEntries();
      const last = e[e.length - 1];
      if (last) addMetric({ type: 'vitals', category: 'core_web_vitals', name: 'LCP', value: last.startTime, unit: 'ms' });
    });
    try {
      po.observe({ entryTypes: ['largest-contentful-paint'] });
      observersRef.current.push(po);
    } catch {
      // ignore
    }
  }, [addMetric]);

  // Snapshot slow resources into metrics (threshold/limit to avoid noise)
  const snapshotResources = useCallback(() => {
    if (typeof window === 'undefined') return;
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    if (!resources || resources.length === 0) return;
    const threshold = 100; // ms
    let added = 0;
    const limit = 50;
    for (const r of resources) {
      const duration = Math.round(r.duration);
      if (duration < threshold) continue;
      const url = r.name || '';
      const short = (() => {
        try { const u = new URL(url); return (u.pathname.split('/').pop() || u.hostname) || url; } catch { return url.split('/').pop() || url; }
      })();
      const initiator = (r as PerformanceResourceTiming).initiatorType || 'other';
      // Extract Server-Timing breakdown when present
      let srvDb: number | null = null;
      let srvCompute: number | null = null;
      let srvTotal: number | null = null;
      try {
        const st = (r as PerformanceResourceTiming & { serverTiming?: ReadonlyArray<PerformanceServerTiming> }).serverTiming;
        if (Array.isArray(st) && st.length > 0) {
          for (const s of st) {
            const n = (s.name || '').toLowerCase();
            if (n === 'db') srvDb = Math.round(s.duration);
            else if (n === 'compute') srvCompute = Math.round(s.duration);
            else if (n === 'total') srvTotal = Math.round(s.duration);
          }
        }
      } catch {
        // ignore typing differences across browsers
      }
      addMetric({
        type: 'resource',
        category: 'loading',
        name: 'resource_load',
        value: duration,
        unit: 'ms',
        metadata: {
          name: short || url,
          initiatorType: initiator,
          transferSize: typeof r.transferSize === 'number' ? r.transferSize : 0,
          serverTiming: srvDb !== null || srvCompute !== null || srvTotal !== null
            ? { db: srvDb, compute: srvCompute, total: srvTotal }
            : undefined,
        },
      });
      added += 1;
      if (added >= limit) break;
    }
  }, [addMetric]);

  const startTracking = useCallback(() => {
    if (isTrackingRef.current) return;
    isTrackingRef.current = true;
    setIsTracking(true);
    setSession({
      sessionId: `s_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      startTime: Date.now(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      url: typeof location !== 'undefined' ? location.href : 'unknown',
    });
    trackNavigationNow();
    snapshotResources();
    subscribeWebVitals().then((unsub) => { vitalsUnsubRef.current = unsub; });
    observeLCPFallback();
  }, [observeLCPFallback, subscribeWebVitals, trackNavigationNow, snapshotResources]);

  const stopTracking = useCallback(() => {
    if (!isTrackingRef.current) return;
    // Capture any resources that loaded after start
    snapshotResources();
    isTrackingRef.current = false;
    setIsTracking(false);
    if (vitalsUnsubRef.current) {
      vitalsUnsubRef.current();
      vitalsUnsubRef.current = null;
    }
    observersRef.current.forEach(o => { try { o.disconnect(); } catch { /* noop */ } });
    observersRef.current = [];
  }, [snapshotResources]);

  const clearMetrics = useCallback(() => {
    setMetrics([]);
  }, []);

  const addCustomMetric = useCallback<UsePerformanceMonitoringResult['addCustomMetric']>((metric) => {
    const { metadata, ...rest } = metric;
    addMetric({ ...rest, metadata: (metadata ?? null) as Json | null });
  }, [addMetric]);

  const trackComponentPerformance = useCallback<UsePerformanceMonitoringResult['trackComponentPerformance']>((componentName, operation, durationMs) => {
    addMetric({ type: 'component', category: 'render', name: `${componentName}_${operation}`, value: durationMs, unit: 'ms', metadata: ({ component: componentName, op: operation } as unknown) as Json });
  }, [addMetric]);

  const trackDatabasePerformance = useCallback<UsePerformanceMonitoringResult['trackDatabasePerformance']>((queryName, durationMs, metadata) => {
    addMetric({ type: 'database', category: 'query', name: queryName, value: durationMs, unit: 'ms', metadata: (metadata ?? null) as Json | null });
  }, [addMetric]);

  useEffect(() => () => {
    if (isTrackingRef.current) {
      if (vitalsUnsubRef.current) vitalsUnsubRef.current();
      observersRef.current.forEach(o => { try { o.disconnect(); } catch { /* noop */ } });
    }
  }, []);

  return {
    metrics,
    session,
    isTracking,
    startTracking,
    stopTracking,
    clearMetrics,
    addCustomMetric,
    trackComponentPerformance,
    trackDatabasePerformance,
  };
}
